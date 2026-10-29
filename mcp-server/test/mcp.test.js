/*
 * The MCP face (the MCP plan, Step 2), against a running server: `npm run server:dev`, then
 *   OKS_URL=http://127.0.0.1:8787 node --test mcp-server/test/mcp.test.js
 * The agent is this test speaking JSON-RPC to /mcp, as Claude Code would; each identity's owner is a device joined to
 * its room (helpers.js), answering as the web app will (Step 4). Two identities on one server, so every check that a
 * plan, an acceptance or a refusal stays with its own identity is made against the other one too.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { BASE, identity, dev, enter } = require('./helpers');

const hexOf = (u8) => Buffer.from(u8).toString('hex');

/* the agent's side: one MCP session */
async function session() {
  const post = async (body, sid) => fetch(`${BASE}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...(sid ? { 'Mcp-Session-Id': sid } : {}) },
    body: JSON.stringify(body),
  });
  const r = await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } } });
  assert.equal(r.status, 200);
  const sid = r.headers.get('Mcp-Session-Id');
  assert.match(sid, /^[0-9a-f]{32}$/);
  assert.equal((await post({ jsonrpc: '2.0', method: 'notifications/initialized' }, sid)).status, 202);
  let n = 1;
  const rpc = async (method, params) => (await post({ jsonrpc: '2.0', id: ++n, method, params }, sid)).json();
  /* a tool's answer: its structured result, or {refused: <text>} when the tool said no */
  const tool = async (name, args = {}) => {
    const m = await rpc('tools/call', { name, arguments: args });
    assert.ok(m.result, JSON.stringify(m));
    return m.result.isError ? { refused: m.result.content[0].text } : m.result.structuredContent;
  };
  return { sid, rpc, tool, post };
}

/* every owner socket closes when the tests end, failed or not: an open one keeps node running */
const sockets = [];
test.after(() => { for (const c of sockets) c.close(); });

/* an owner: a device of the identity in its room, reading the room's mcp messages in order */
async function owner(me, name = 'Chromium') {
  const { c, answer } = await enter(me, dev(name, 'webapp'));
  sockets.push(c);
  assert.equal(answer.t, 'joined');
  /* what re() read past while waiting for its reply (the room tells the sender too, before it answers) */
  const inbox = [];
  const next = (ms) => (inbox.length ? Promise.resolve(inbox.shift()) : c.next(ms));
  return {
    c,
    /* the next mcp message that matches (others are skipped), or a throw naming what came instead */
    until: async (pred, ms = 5000) => {
      const seen = [];
      const end = Date.now() + ms;
      for (;;) {
        const m = await next(Math.max(1, end - Date.now())).catch(() => null);
        if (!m) throw new Error(`never came; saw ${JSON.stringify(seen).slice(0, 400)}`);
        if (m.t === 'mcp' && pred(m)) return m;
        seen.push(m);
      }
    },
    /* nothing from the agents for a while: a plan for another identity never reaches this one */
    quiet: async (ms = 800) => {
      const m = await next(ms).catch(() => null);
      assert.ok(!m || m.t !== 'mcp', `this room heard ${JSON.stringify(m)}`);
    },
    /* an owner's answer, and the room's reply to it (ok, the agents list, or an error) */
    re: async (msg) => {
      c.send({ t: 'mcp-re', ...msg });
      for (;;) {
        const m = await c.next();
        if (m.t === 'error' || (m.t === 'mcp' && (m.ev === 'ok' || m.ev === 'agents'))) return m;
        inbox.push(m);
      }
    },
  };
}

test('initialize, the tools, and the guards: no session, an unknown one, another site', async () => {
  const s = await session();
  const tools = (await s.rpc('tools/list')).result.tools.map((t) => t.name);
  for (const t of ['hello', 'status', 'plan_new', 'plan_target', 'plan_add', 'plan_hold', 'plan_remove', 'plan_show', 'plan_submit', 'plan_fill', 'plan_wait', 'plan_finish']) assert.ok(tools.includes(t), t);
  assert.ok((await s.tool('plan_new', { identity: 'a'.repeat(64), title: 'x' })).refused.includes('hello first'));
  const none = await s.post({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  assert.equal((await none.json()).error.code, -32600);
  assert.equal((await s.post({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, 'f'.repeat(32))).status, 404);
  const other = await fetch(`${BASE}/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' }, body: '{}' });
  assert.equal(other.status, 403);
});

test('the agent key: the same agent next session; a copycat with the same name is a new agent', async () => {
  const a = await session();
  const first = await a.tool('hello', { name: 'Claude' });
  assert.match(first.agent_key, /^[0-9a-f]{64}$/);
  const again = await (await session()).tool('hello', { name: 'Claude', agent_key: first.agent_key });
  assert.deepEqual(again, { agent_id: first.agent_id });
  const copycat = await (await session()).tool('hello', { name: 'Claude' });
  assert.notEqual(copycat.agent_id, first.agent_id);
});

test('a plan shows live only in its target\'s room, and moves when retargeted', async () => {
  const A = await identity(`mcp A ${Date.now()}`);
  const B = await identity(`mcp B ${Date.now()}`);
  const ownerA = await owner(A);
  const ownerB = await owner(B);
  const s = await session();
  const { agent_id } = await s.tool('hello', { name: 'Claude' });

  const p = await s.tool('plan_new', { identity: hexOf(A.identityPublicKey), title: 'sign two commits' });
  assert.equal(p.agent_state, 'pending');
  assert.equal(p.owner_online, true);
  assert.equal((await ownerA.until((m) => m.ev === 'agent')).agent.id, agent_id);
  assert.equal((await ownerA.until((m) => m.ev === 'plan')).plan.title, 'sign two commits');
  await s.tool('plan_add', { plan_id: p.plan_id, op: 'sign', key: { kind: 'gpg', identity: 'me@example.com' }, data: 'tree 1234', reason: 'commit A' });
  const grown = await ownerA.until((m) => m.ev === 'plan');
  assert.deepEqual(grown.plan.items.map((x) => x.reason), ['commit A']);
  await ownerB.quiet();

  await s.tool('plan_target', { plan_id: p.plan_id, identity: hexOf(B.identityPublicKey) });
  assert.equal((await ownerA.until((m) => m.ev === 'plan-gone')).plan, p.plan_id);
  assert.equal((await ownerB.until((m) => m.ev === 'plan')).plan.id, p.plan_id);
  /* what a device joining later sees */
  const list = await ownerB.re({ op: 'agents' });
  assert.deepEqual(list.plans.map((x) => x.id), [p.plan_id]);
  assert.deepEqual(list.agents.map((x) => [x.id, x.state]), [[agent_id, 'pending']]);
  ownerA.c.close();
  ownerB.c.close();
});

test('submit: refused until the owner accepts; accepted at A means nothing at B; no owner online, no submit', async () => {
  const A = await identity(`mcp A2 ${Date.now()}`);
  const B = await identity(`mcp B2 ${Date.now()}`);
  const ownerA = await owner(A);
  const ownerB = await owner(B);
  const s = await session();
  const { agent_id, agent_key } = await s.tool('hello', { name: 'Claude' });
  const add = (plan_id) => s.tool('plan_add', { plan_id, op: 'sign', key: { kind: 'ssh', identity: 'ssh://me@host' }, data: 'aGVsbG8=', encoding: 'base64', reason: 'a push' });

  const pa = await s.tool('plan_new', { identity: hexOf(A.identityPublicKey), title: 'for A' });
  await add(pa.plan_id);
  assert.match((await s.tool('plan_submit', { plan_id: pa.plan_id })).refused, /not accepted you yet \(pending\)/);
  /* an agent can never accept itself: the registry is written by the identity's own joined devices only */
  assert.deepEqual(await ownerA.re({ op: 'agent', agent: agent_id, state: 'accepted' }), { t: 'mcp', ev: 'ok', op: 'agent' });
  const sub = await s.tool('plan_submit', { plan_id: pa.plan_id });
  assert.equal(sub.state, 'submitted');
  const asked = await ownerA.until((m) => m.ev === 'submit');
  assert.equal(asked.plan.agent.id, agent_id);
  assert.equal(asked.plan.items[0].data, 'aGVsbG8=');

  const pb = await s.tool('plan_new', { identity: hexOf(B.identityPublicKey), title: 'for B' });
  await add(pb.plan_id);
  assert.match((await s.tool('plan_submit', { plan_id: pb.plan_id })).refused, /not accepted you yet/);

  /* the same agent, a new session: still accepted at A, still pending at B */
  const s2 = await session();
  await s2.tool('hello', { name: 'Claude', agent_key });
  assert.equal((await s2.tool('status', { identity: hexOf(A.identityPublicKey) })).identity.agent_state, 'accepted');
  assert.equal((await s2.tool('status', { identity: hexOf(B.identityPublicKey) })).identity.agent_state, 'pending');

  /* B accepts, then goes offline: a submit needs an owner there to approve it */
  await ownerB.re({ op: 'agent', agent: agent_id, state: 'accepted' });
  ownerB.c.close();
  await new Promise((r) => setTimeout(r, 300));
  assert.match((await s.tool('plan_submit', { plan_id: pb.plan_id })).refused, /no owner device is online/);
  ownerA.c.close();
});

test('the run: the owner approves, a placeholder is filled inside the budget, results come back to plan_wait', async () => {
  const A = await identity(`mcp A3 ${Date.now()}`);
  const ownerA = await owner(A);
  const s = await session();
  const { agent_id } = await s.tool('hello', { name: 'Claude' });
  const p = await s.tool('plan_new', { identity: hexOf(A.identityPublicKey), title: 'commit A, pin it in B' });
  await ownerA.re({ op: 'agent', agent: agent_id, state: 'accepted' });
  const one = await s.tool('plan_add', { plan_id: p.plan_id, op: 'sign', key: { kind: 'gpg', identity: 'me@example.com' }, data: 'commit A', reason: 'repo A' });
  const two = await s.tool('plan_hold', { plan_id: p.plan_id, op: 'sign', key: { kind: 'gpg', identity: 'me@example.com' }, reason: 'repo B: pins A\'s signed hash' });
  assert.deepEqual(two.waiting, [two.item]);
  assert.match((await s.tool('plan_fill', { plan_id: p.plan_id, item: two.item, data: 'too early' })).refused, /draft/);
  await s.tool('plan_submit', { plan_id: p.plan_id });
  await ownerA.until((m) => m.ev === 'submit');

  /* the owner approved and pressed: running; item 1 signed; the budget pauses for the placeholder */
  const t0 = Date.now();
  const waiting = s.tool('plan_wait', { plan_id: p.plan_id, seconds: 10 });
  assert.equal((await ownerA.re({ op: 'plan', plan: p.plan_id, state: 'paused', results: [{ item: one.item, signature: 'sig-A' }] })).ev, 'ok');
  const w = await waiting;
  /* an answer that lands as the wait starts is returned at once - not missed while it waits out its 10 s */
  assert.ok(Date.now() - t0 < 3000, `plan_wait took ${Date.now() - t0} ms`);
  assert.equal(w.state, 'paused');
  assert.deepEqual(w.results[one.item], { signature: 'sig-A' });
  assert.deepEqual(w.waiting, [two.item]);

  /* a fill must be the placeholder's; then it goes to the owner's web app and runs in the same budget */
  assert.match((await s.tool('plan_fill', { plan_id: p.plan_id, item: one.item, data: 'x' })).refused, /not a placeholder/);
  await s.tool('plan_fill', { plan_id: p.plan_id, item: two.item, data: 'commit B pins sig-A' });
  const fill = await ownerA.until((m) => m.ev === 'fill');
  assert.deepEqual([fill.item, fill.data], [two.item, 'commit B pins sig-A']);
  /* a wait already waiting is woken by the owner's answer */
  const t1 = Date.now();
  const doneWait = s.tool('plan_wait', { plan_id: p.plan_id, seconds: 10 });
  await new Promise((r) => setTimeout(r, 500));
  await ownerA.re({ op: 'plan', plan: p.plan_id, state: 'done', results: [{ item: two.item, signature: 'sig-B' }], receipts: [{ seq: 41, code: 'OK' }, { seq: 43, code: 'OK' }] });
  const done = await doneWait;
  assert.ok(Date.now() - t1 < 3000, `the woken plan_wait took ${Date.now() - t1} ms`);
  assert.equal(done.state, 'done');
  assert.deepEqual(done.results[two.item], { signature: 'sig-B' });
  assert.deepEqual(done.receipts.map((r) => r.seq), [41, 43]);
  ownerA.c.close();
});

test('block takes effect at once: the agent\'s plans go, and new ones are not shown', async () => {
  const A = await identity(`mcp A4 ${Date.now()}`);
  const ownerA = await owner(A);
  const s = await session();
  const { agent_id } = await s.tool('hello', { name: 'Claude' });
  const p = await s.tool('plan_new', { identity: hexOf(A.identityPublicKey), title: 'one' });
  await ownerA.until((m) => m.ev === 'plan');
  await ownerA.re({ op: 'agent', agent: agent_id, state: 'blocked' });
  assert.equal((await ownerA.until((m) => m.ev === 'plan-gone')).plan, p.plan_id);
  /* and every device of the owner hears the agent is blocked */
  assert.equal((await ownerA.until((m) => m.ev === 'agent')).agent.state, 'blocked');
  const again = await s.tool('plan_new', { identity: hexOf(A.identityPublicKey), title: 'two' });
  assert.deepEqual([again.agent_state, again.shown], ['blocked', false]);
  await ownerA.quiet();
  ownerA.c.close();
});

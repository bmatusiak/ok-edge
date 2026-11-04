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
/* FINGERPRINTS FIRST (2026-11-04): an item names the SHA-256 of its data; the data comes with plan_data once it runs */
const fp = (text) => require('crypto').createHash('sha256').update(text).digest('hex');
const item = (data, reason, key = { kind: 'ssh', identity: 'ssh://me@host' }) => ({ op: 'sign', key, reason, fingerprint: fp(data) });
const newPlan = (s, identity, title, items = [item('x', 'r')]) => s.tool('plan_new', { identity: hexOf(identity), title, card: 'test agent', items });

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
    you: answer.you,
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
  assert.deepEqual(tools, ['hello', 'status', 'card_new', 'plan_new', 'plan_target', 'plan_remove', 'plan_show', 'plan_submit', 'plan_data', 'plan_wait', 'plan_finish']);
  assert.ok((await s.tool('plan_new', { identity: 'a'.repeat(64), title: 'x', card: 'c', items: [] })).refused.includes('hello first'));
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

  const p = await newPlan(s, A.identityPublicKey, 'sign two commits', [item('tree 1234', 'commit A'), item('tree 5678', 'commit B')]);
  assert.equal(p.agent_state, 'pending');
  assert.equal(p.owner_online, true);
  assert.equal((await ownerA.until((m) => m.ev === 'agent')).agent.id, agent_id);
  const shown = await ownerA.until((m) => m.ev === 'plan');
  assert.equal(shown.plan.title, 'sign two commits');
  assert.equal(shown.plan.card, 'test agent');
  assert.deepEqual(shown.plan.items.map((x) => [x.reason, x.fingerprint]), [['commit A', fp('tree 1234')], ['commit B', fp('tree 5678')]]);
  await s.tool('plan_remove', { plan_id: p.plan_id, item: 2 });
  assert.deepEqual((await ownerA.until((m) => m.ev === 'plan')).plan.items.map((x) => x.reason), ['commit A']);
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
  const pa = await newPlan(s, A.identityPublicKey, 'for A', [item('hello', 'a push')]);
  assert.match((await s.tool('plan_submit', { plan_id: pa.plan_id })).refused, /not accepted you yet \(pending\)/);
  /* an agent can never accept itself: the registry is written by the identity's own joined devices only */
  assert.deepEqual(await ownerA.re({ op: 'agent', agent: agent_id, state: 'accepted' }), { t: 'mcp', ev: 'ok', op: 'agent' });
  const sub = await s.tool('plan_submit', { plan_id: pa.plan_id });
  assert.equal(sub.state, 'submitted');
  const asked = await ownerA.until((m) => m.ev === 'submit');
  assert.equal(asked.plan.agent.id, agent_id);
  assert.deepEqual(asked.plan.items[0], { item: 1, op: 'sign', key: { kind: 'ssh', identity: 'ssh://me@host' }, reason: 'a push', fingerprint: fp('hello') }, 'the fingerprint, never data');

  const pb = await newPlan(s, B.identityPublicKey, 'for B', [item('hello', 'a push')]);
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

test('the run: the fingerprints approved, then the data - each checked first, passed to the owner\'s devices and kept nowhere - and every result at the end', async () => {
  const A = await identity(`mcp A3 ${Date.now()}`);
  const ownerA = await owner(A);
  const s = await session();
  const { agent_id } = await s.tool('hello', { name: 'Claude' });
  const rsa = { kind: 'rsa', slot: 3, bits: 4096 };
  const digest = Buffer.alloc(64, 9);
  const p = await s.tool('plan_new', { identity: hexOf(A.identityPublicKey), title: 'sign the APK', card: 'release signer', items: [
    { op: 'sign', key: rsa, reason: 'APK v2', fingerprint: require('crypto').createHash('sha256').update(digest).digest('hex') },
    item('commit A', 'repo A'),
  ] });
  assert.match((await s.tool('plan_new', { identity: hexOf(A.identityPublicKey), title: 'x', card: 'c', items: [{ op: 'sign', key: { kind: 'rsa', slot: 3 }, reason: 'r', fingerprint: fp('x') }] })).refused, /bits are/);
  assert.match((await s.tool('plan_new', { identity: hexOf(A.identityPublicKey), title: 'x', card: 'c', items: [{ op: 'sign', key: rsa, reason: 'r' }] })).refused, /fingerprint/);
  await ownerA.re({ op: 'agent', agent: agent_id, state: 'accepted' });
  assert.match((await s.tool('plan_data', { plan_id: p.plan_id, items: [{ item: 2, data: 'commit A' }] })).refused, /draft/);
  await s.tool('plan_submit', { plan_id: p.plan_id });
  await ownerA.until((m) => m.ev === 'submit');
  assert.match((await s.tool('plan_data', { plan_id: p.plan_id, items: [{ item: 2, data: 'commit A' }] })).refused, /submitted: its data is sent once it runs/);

  /* the owner approved and pressed: running - the wait says which items' data it waits for */
  const t0 = Date.now();
  const waiting = s.tool('plan_wait', { plan_id: p.plan_id, seconds: 10 });
  assert.equal((await ownerA.re({ op: 'plan', plan: p.plan_id, state: 'running' })).ev, 'ok');
  const w = await waiting;
  /* an answer that lands as the wait starts is returned at once - not missed while it waits out its 10 s */
  assert.ok(Date.now() - t0 < 3000, `plan_wait took ${Date.now() - t0} ms`);
  assert.deepEqual([w.state, w.waiting], ['running', [1, 2]]);
  /* the room told its devices the plan runs (read here, so the quiet below listens past it) */
  await ownerA.until((m) => m.ev === 'plan' && m.plan.state === 'running');

  /* data that is not what was approved is refused here, and none of the call is sent */
  assert.match((await s.tool('plan_data', { plan_id: p.plan_id, items: [{ item: 2, data: 'commit A' }, { item: 1, data: Buffer.alloc(64, 8).toString('base64'), encoding: 'base64' }] })).refused, /item 1's data does not match its fingerprint/);
  await ownerA.quiet();
  const sent = await s.tool('plan_data', { plan_id: p.plan_id, items: [{ item: 1, data: digest.toString('base64'), encoding: 'base64' }, { item: 2, data: 'commit A' }] });
  assert.deepEqual(sent.waiting, []);
  const d1 = await ownerA.until((m) => m.ev === 'data');
  const d2 = await ownerA.until((m) => m.ev === 'data');
  assert.deepEqual([[d1.item, d1.encoding], [d2.item, d2.data]], [[1, 'base64'], [2, 'commit A']]);
  assert.match((await s.tool('plan_data', { plan_id: p.plan_id, items: [{ item: 2, data: 'commit A' }] })).refused, /sent already/);
  /* the room's mirror keeps the fingerprints only */
  const mirror = (await ownerA.re({ op: 'agents' })).plans.find((x) => x.id === p.plan_id);
  assert.ok(mirror.items.every((x) => x.data === undefined && /^[0-9a-f]{64}$/.test(x.fingerprint)));

  /* a wait already waiting is woken by the owner's answer: every result, at the end */
  const t1 = Date.now();
  const doneWait = s.tool('plan_wait', { plan_id: p.plan_id, seconds: 10 });
  await new Promise((r) => setTimeout(r, 500));
  await ownerA.re({ op: 'plan', plan: p.plan_id, state: 'done', results: [{ item: 1, signature: 'sig-1' }, { item: 2, signature: 'sig-2' }], receipts: [{ seq: 41, code: 'OK' }, { seq: 43, code: 'OK' }] });
  const done = await doneWait;
  assert.ok(Date.now() - t1 < 3000, `the woken plan_wait took ${Date.now() - t1} ms`);
  assert.equal(done.state, 'done');
  assert.deepEqual([done.results[1], done.results[2]], [{ signature: 'sig-1' }, { signature: 'sig-2' }]);
  assert.deepEqual(done.receipts.map((r) => r.seq), [41, 43]);
  ownerA.c.close();
});

test('card_new: the agent asks for its card - a card request submitted at once, its keys shown to the owner, the end told as a plan\'s', async () => {
  const A = await identity(`mcp A5 ${Date.now()}`);
  const ownerA = await owner(A);
  const s = await session();
  const { agent_id } = await s.tool('hello', { name: 'release workflow' });
  const ask = { identity: hexOf(A.identityPublicKey), label: 'release signer', slots: [3], reason: 'sign ok-edge releases' };
  assert.match((await s.tool('card_new', { ...ask, slots: [5] })).refused, /stored RSA slots/);
  assert.match((await s.tool('card_new', { ...ask, slots: [] })).refused, /at least one key/);
  /* not accepted yet: shown to the owner, kept a draft with the reason; plan_submit sends it once they accept */
  const c = await s.tool('card_new', ask);
  assert.deepEqual([c.kind, c.state, c.ask], ['card', 'draft', { label: 'release signer', slots: [3], days: 0, reason: 'sign ok-edge releases' }]);
  assert.match(c.why, /not accepted you yet/);
  assert.equal((await ownerA.until((m) => m.ev === 'agent')).agent.state, 'pending', 'the owner sees who asks');
  assert.match((await s.tool('plan_submit', { plan_id: c.plan_id })).refused, /not accepted you yet/);
  await ownerA.re({ op: 'agent', agent: agent_id, state: 'accepted' });
  const sub = await s.tool('plan_submit', { plan_id: c.plan_id });
  assert.deepEqual([sub.state, sub.why], ['submitted', null]);
  const asked = await ownerA.until((m) => m.ev === 'submit');
  assert.deepEqual([asked.plan.kind, asked.plan.agent.id, asked.plan.ask.slots], ['card', agent_id, [3]]);
  assert.match((await s.tool('plan_data', { plan_id: c.plan_id, items: [{ item: 1, data: 'x' }] })).refused, /a card ask takes no data/);
  await ownerA.re({ op: 'plan-claim', plan: c.plan_id });
  await ownerA.re({ op: 'plan', plan: c.plan_id, state: 'done' });
  assert.equal((await s.tool('plan_wait', { plan_id: c.plan_id, seconds: 2 })).state, 'done');
  ownerA.c.close();
});

test('one device runs a plan: the first Approve claims it, another device of the identity is refused and hears the claim', async () => {
  const A = await identity(`mcp A4 ${Date.now()}`);
  const desk = await owner(A, 'Desktop');
  const phone = await owner(A, 'Phone');
  const s = await session();
  const { agent_id } = await s.tool('hello', { name: 'Claude' });
  const p = await newPlan(s, A.identityPublicKey, 'one device');
  await desk.re({ op: 'agent', agent: agent_id, state: 'accepted' });
  /* not submitted yet: nothing to claim */
  assert.match((await desk.re({ op: 'plan-claim', plan: p.plan_id })).why, /draft, not waiting for approval/);
  await s.tool('plan_submit', { plan_id: p.plan_id });
  await desk.until((m) => m.ev === 'submit');
  await phone.until((m) => m.ev === 'submit');
  assert.equal((await desk.re({ op: 'plan-claim', plan: p.plan_id })).ev, 'ok');
  /* the phone hears the claim - its sheet goes - and cannot claim or update it */
  const claimed = await phone.until((m) => m.ev === 'plan' && m.plan.id === p.plan_id && m.plan.by);
  assert.equal(claimed.plan.by, desk.you);
  assert.match((await phone.re({ op: 'plan-claim', plan: p.plan_id })).why, /another of your devices runs it/);
  assert.match((await phone.re({ op: 'plan', plan: p.plan_id, state: 'declined' })).why, /another of your devices runs it/);
  /* the claiming device's updates are taken; claiming again is no error */
  assert.equal((await desk.re({ op: 'plan-claim', plan: p.plan_id })).ev, 'ok');
  assert.equal((await desk.re({ op: 'plan', plan: p.plan_id, state: 'running' })).ev, 'ok');
  assert.equal((await s.tool('plan_wait', { plan_id: p.plan_id, seconds: 1 })).state, 'running');
  desk.c.close();
  phone.c.close();
});

test('block takes effect at once: the agent\'s plans go, and new ones are not shown', async () => {
  const A = await identity(`mcp A4 ${Date.now()}`);
  const ownerA = await owner(A);
  const s = await session();
  const { agent_id } = await s.tool('hello', { name: 'Claude' });
  const p = await newPlan(s, A.identityPublicKey, 'one');
  await ownerA.until((m) => m.ev === 'plan');
  await ownerA.re({ op: 'agent', agent: agent_id, state: 'blocked' });
  assert.equal((await ownerA.until((m) => m.ev === 'plan-gone')).plan, p.plan_id);
  /* and every device of the owner hears the agent is blocked */
  assert.equal((await ownerA.until((m) => m.ev === 'agent')).agent.state, 'blocked');
  const again = await newPlan(s, A.identityPublicKey, 'two');
  assert.deepEqual([again.agent_state, again.shown], ['blocked', false]);
  await ownerA.quiet();
  ownerA.c.close();
});

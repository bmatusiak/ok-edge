/**
 * THE USER'S SERVER (ok-edge plan M1): one Cloudflare Worker that hosts the web app and the rooms its devices meet in.
 * Brad, 2026-10-26: "lets host it on the MCP server" (one site: the key's rpId is this host, no cross-site, no address
 * to type); "the mcp service acts as 2 main things, the MCP service and websocket service ... they interwork together".
 *
 *   /ws/<identity id>  a websocket into that bucket identity's ROOM (a Durable Object, one per identity): the devices
 *                      of the identity online now. A device enters with its bucket key's proof over this host and a
 *                      fresh nonce (node-onlykey-lib bucket/src/room.js) - the key alone, no code, no account - and
 *                      then passes frames to the others by device id. The server never holds a bucket byte: frames
 *                      are passed as they come, and the trade over them is proved and sealed end to end (M2).
 *   /mcp               the MCP face (mcp.js): an AI agent builds a sign/decrypt plan for an identity; the plan shows
 *                      live in that identity's room, whose owner accepts the agent, approves and presses
 *   anything else      the web app (docs/, the static build), one page for every route.
 *
 * THE ROOM AND THE AGENTS. Per identity, the room keeps which agents its owner accepted or blocked (written only by the
 * identity's own joined devices - an agent can never accept itself) and a mirror of the plans that target it, so a
 * device that joins later sees them. The owner's devices hear {t:'mcp', ev, ...} and answer {t:'mcp-re', op, ...}.
 *
 * HIBERNATION: the room accepts its sockets through the Durable Object's hibernation API, so a quiet room is evicted
 * from memory and costs nothing while its devices stay connected; each socket's state lives in its attachment, not in
 * the object. Pings are answered by the runtime itself (an auto-response) without waking the room.
 */
import { DurableObject } from 'cloudflare:workers';
import bucketLib from 'node-onlykey-lib/bucket';
import bytes from 'node-onlykey-lib/bytes';
import { handleMcp, McpSession, AgentSession } from './mcp.js';

export { McpSession, AgentSession };

const { room } = bucketLib;
const ROOM_PATH = /^\/ws\/([0-9a-f]{32})$/;
const AGENT_STATES = ['accepted', 'blocked', 'removed'];
/* the largest frame passed on: a first sync of post-quantum keys is ~240 KB; room to spare, never unbounded */
const MAX_FRAME = 4 * 1024 * 1024;
/* a socket that has not joined by then is closed: an open connection with no proof holds nothing open for long */
const JOIN_WITHIN_MS = 30_000;
/* the sealed copy's bounds: rows a get or a put names, and one sealed unit (an Edge links block is ~25 KB) */
const SEALED_MAX_IDS = 2000;
const SEALED_MAX_BLOB = 1024 * 1024;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/mcp') return handleMcp(request, env);
    const m = ROOM_PATH.exec(url.pathname);
    if (!m) return env.ASSETS.fetch(request);
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('a websocket only', { status: 426 });
    return env.ROOMS.get(env.ROOMS.idFromName(m[1])).fetch(request);
  },
};

const send = (ws, msg) => {
  try { ws.send(JSON.stringify(msg)); } catch { /* the socket is closing; its close handler tells the room */ }
};

export class IdentityRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"t":"ping"}', '{"t":"pong"}'));
  }

  /* one connection: accept it, give it this connection's challenge, and give it JOIN_WITHIN_MS to answer */
  async fetch(request) {
    const url = new URL(request.url);
    const [client, server] = Object.values(new WebSocketPair());
    const { nonce, message } = room.challenge((n) => crypto.getRandomValues(new Uint8Array(n)));
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ room: ROOM_PATH.exec(url.pathname)[1], host: url.host, nonce: bytes.toHex(nonce), device: null, since: Date.now() });
    send(server, message);
    if ((await this.ctx.storage.getAlarm()) === null) await this.ctx.storage.setAlarm(Date.now() + JOIN_WITHIN_MS);
    return new Response(null, { status: 101, webSocket: client });
  }

  /*
   * The devices that have joined: [socket, attachment], ONE per device - its newest socket. A replaced socket is still
   * listed by getWebSockets until its close completes, and changing its attachment once it closes does not hold, so the
   * room decides by device: the latest join of a device id is that device.
   */
  joined() {
    const newest = new Map();
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment();
      if (!a || !a.device) continue;
      const have = newest.get(a.device.id);
      if (!have || a.joinedAt > have[1].joinedAt) newest.set(a.device.id, [ws, a]);
    }
    return [...newest.values()];
  }

  async webSocketMessage(ws, data) {
    if (typeof data !== 'string' || data.length > MAX_FRAME) return ws.close(1009, 'text frames up to 4 MiB');
    let msg;
    try { msg = JSON.parse(data); } catch { return ws.close(1007, 'not JSON'); }
    const me = ws.deserializeAttachment();

    if (!me.device) {
      /* one try: the join, checked against this connection's own challenge and this server's host */
      const check = room.checkJoin(me.room, msg, { nonce: bytes.fromHex(me.nonce), host: me.host });
      if (!check.ok) {
        send(ws, { t: 'refused' });
        return ws.close(4401, 'refused');
      }
      /* one socket per device: a device that reconnects replaces its old socket (joined() counts the newest only) */
      const old = this.joined().find(([, a]) => a.device.id === check.device.id);
      const peers = this.joined().filter(([, a]) => a.device.id !== check.device.id).map(([, a]) => a.device);
      ws.serializeAttachment({ ...me, device: check.device, nonce: null, joinedAt: Date.now() });
      if (old) {
        old[0].close(4409, 'replaced');
        return send(ws, { t: 'joined', you: check.device.id, peers });
      }
      send(ws, { t: 'joined', you: check.device.id, peers });
      for (const [other] of this.joined()) if (other !== ws) send(other, { t: 'peer', up: check.device });
      return;
    }

    switch (msg && msg.t) {
      case 'frame': {
        if (typeof msg.to !== 'string' || typeof msg.body !== 'string') return send(ws, { t: 'error', why: 'a frame is {to, body}' });
        const to = this.joined().find(([, a]) => a.device.id === msg.to);
        if (!to) return send(ws, { t: 'gone', to: msg.to });
        return send(to[0], { t: 'frame', from: me.device.id, body: msg.body });
      }
      case 'peers':
        return send(ws, { t: 'peers', peers: this.joined().filter(([s]) => s !== ws).map(([, a]) => a.device) });
      case 'mcp-re': {
        /* the reply carries the device's own id for it (re): the room's broadcasts reach the sender too, before it */
        const r = await this.fromOwner(me.room, msg);
        return send(ws, msg.re !== undefined ? { ...r, re: msg.re } : r);
      }
      case 'sealed':
        return send(ws, { t: 'sealed', re: msg.re, ...this.sealedOp(me.room, msg) });
      default:
        return send(ws, { t: 'error', why: `unknown message ${JSON.stringify(msg && msg.t)}` });
    }
  }

  /* ------------------------------------------------------------------ the sealed copy (bucket/src/sealedcopy.js) */

  /*
   * THE IDENTITY'S SEALED COPY, IN THIS ROOM'S SQLITE (Phase 3; Brad, 2026-10-29: "the server's sealed copy will have a
   * hash table for changes"; the room's own SQLite, one row per unit). Rows the server cannot read: a keyed id, a keyed
   * change tag, a sealed unit - written and read only by the identity's own joined devices (this is past the join). Kept
   * only for identities this server is set to keep (SEALED_IDENTITIES: their ids, comma-separated, or * for all): any
   * other gets an empty table and a refused put.
   */
  sealedOn(identity) {
    const list = String(this.env.SEALED_IDENTITIES || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    return list.includes('*') || list.includes(String(identity).toLowerCase());
  }
  sealedSql() {
    const sql = this.ctx.storage.sql;
    sql.exec('CREATE TABLE IF NOT EXISTS sealed (id TEXT PRIMARY KEY, tag TEXT NOT NULL, blob TEXT NOT NULL, at INTEGER NOT NULL)');
    return sql;
  }
  sealedOp(identity, msg) {
    if (!this.sealedOn(identity)) return msg.op === 'table' ? { on: false, rows: {} } : { ok: false, why: 'this server keeps no sealed copy for this identity' };
    const sql = this.sealedSql();
    const HEX = /^[0-9a-f]{32}$/;
    if (msg.op === 'table') {
      const rows = {};
      for (const r of sql.exec('SELECT id, tag FROM sealed').toArray()) rows[r.id] = r.tag;
      return { on: true, rows };
    }
    if (msg.op === 'get') {
      const ids = Array.isArray(msg.ids) ? msg.ids.filter((id) => typeof id === 'string' && HEX.test(id)).slice(0, SEALED_MAX_IDS) : [];
      const rows = {};
      for (const id of ids) {
        const r = sql.exec('SELECT blob FROM sealed WHERE id = ?', id).toArray()[0];
        if (r) rows[id] = r.blob;
      }
      return { rows };
    }
    if (msg.op === 'put') {
      const entries = Object.entries(msg.rows && typeof msg.rows === 'object' ? msg.rows : {});
      if (entries.length > SEALED_MAX_IDS) return { ok: false, why: `at most ${SEALED_MAX_IDS} rows a put` };
      for (const [id, r] of entries) {
        if (!HEX.test(id) || !r || typeof r.tag !== 'string' || !HEX.test(r.tag) || typeof r.blob !== 'string' || r.blob.length > SEALED_MAX_BLOB) {
          return { ok: false, why: `row ${String(id).slice(0, 12)}: an id and a tag of 32 hex, a blob up to ${SEALED_MAX_BLOB} characters` };
        }
      }
      const now = Date.now();
      for (const [id, r] of entries) sql.exec('INSERT INTO sealed (id, tag, blob, at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET tag = excluded.tag, blob = excluded.blob, at = excluded.at', id, r.tag, r.blob, now);
      return { ok: true, n: entries.length };
    }
    return { ok: false, why: `no sealed ${JSON.stringify(msg.op)}` };
  }

  async webSocketClose(ws) {
    this.left(ws);
  }

  async webSocketError(ws) {
    this.left(ws);
  }

  /* a joined device left: the others hear it - unless this was a replaced socket and a newer one holds the device */
  left(ws) {
    const a = ws.deserializeAttachment();
    if (!a || !a.device) return;
    const others = this.joined().filter(([s]) => s !== ws);
    if (others.some(([, b]) => b.device.id === a.device.id)) return;
    for (const [other] of others) send(other, { t: 'peer', down: a.device.id });
  }

  /* ------------------------------------------------------------------ the agents and their plans (mcp.js) */

  /* to every joined device of this identity - the owner's web app, phone, desktop */
  tell(msg) { for (const [ws] of this.joined()) send(ws, { t: 'mcp', ...msg }); }
  async agentOf(id) { return this.ctx.storage.get(`agent:${id}`); }
  async plans() { return [...(await this.ctx.storage.list({ prefix: 'plan:' })).values()]; }

  /*
   * An agent's plan, shown (new or changed): the agent is entered as pending the first time it targets this identity,
   * so the owner sees who asks before anything can be submitted. A blocked agent's plans are not shown.
   */
  async show(plan) {
    let a = await this.agentOf(plan.agent.id);
    if (!a) {
      a = { id: plan.agent.id, name: plan.agent.name, state: 'pending', first: Date.now() };
      await this.ctx.storage.put(`agent:${a.id}`, a);
      this.tell({ ev: 'agent', agent: a });
    } else if (a.name !== plan.agent.name) {
      a = { ...a, name: plan.agent.name };
      await this.ctx.storage.put(`agent:${a.id}`, a);
    }
    a = { ...a, last: Date.now() };
    await this.ctx.storage.put(`agent:${a.id}`, a);
    if (a.state === 'blocked') return { agent_state: a.state, owner_online: this.joined().length > 0, shown: false };
    await this.ctx.storage.put(`plan:${plan.id}`, plan);
    this.tell({ ev: 'plan', plan });
    return { agent_state: a.state, owner_online: this.joined().length > 0, shown: true };
  }

  async withdraw(planId, why) {
    if (!(await this.ctx.storage.get(`plan:${planId}`))) return;
    await this.ctx.storage.delete(`plan:${planId}`);
    this.tell({ ev: 'plan-gone', plan: planId, why });
  }

  /* status, for the agent: its state here (unknown until it targets a plan here) and whether an owner is online */
  async agentStatus(me) {
    const a = await this.agentOf(me.id);
    return { agent_state: a ? a.state : 'unknown', owner_online: this.joined().length > 0 };
  }

  /* submit: only an accepted agent, only with an owner device online to approve it - the web app runs it from here */
  async submit(plan) {
    const a = await this.agentOf(plan.agent.id);
    if (!a || a.state !== 'accepted') {
      return { ok: false, why: `the owner has not accepted you yet (${a ? a.state : 'unknown'}): they see your plan in their web app and accept you there` };
    }
    if (!this.joined().length) return { ok: false, why: 'no owner device is online to approve it - try again when the owner has the web app open' };
    await this.ctx.storage.put(`plan:${plan.id}`, plan);
    this.tell({ ev: 'submit', plan });
    return { ok: true };
  }

  async fill(planId, item, data) {
    const plan = await this.ctx.storage.get(`plan:${planId}`);
    if (!plan || !['running', 'paused'].includes(plan.state)) return { ok: false, why: 'the plan is not running here' };
    if (!this.joined().length) return { ok: false, why: 'no owner device is online' };
    const it = plan.items.find((x) => x.item === item);
    if (it) Object.assign(it, data);
    await this.ctx.storage.put(`plan:${planId}`, plan);
    this.tell({ ev: 'fill', plan: planId, item, ...data });
    return { ok: true };
  }

  async finish(planId) {
    const plan = await this.ctx.storage.get(`plan:${planId}`);
    if (!plan) return { ok: false, why: 'the plan is not here' };
    if (!this.joined().length) return { ok: false, why: 'no owner device is online to end its budget' };
    this.tell({ ev: 'finish', plan: planId });
    return { ok: true };
  }

  /*
   * An owner device's answer ({t:'mcp-re', op}): the agents (list, accept, block, remove), or a plan's progress, which
   * goes on to the agent. Only a joined device gets here (webSocketMessage) - the identity's own key proved it.
   */
  async fromOwner(roomId, msg) {
    if (msg.op === 'agents') return { t: 'mcp', ev: 'agents', agents: [...(await this.ctx.storage.list({ prefix: 'agent:' })).values()], plans: await this.plans() };
    if (msg.op === 'agent') {
      if (!AGENT_STATES.includes(msg.state)) return { t: 'error', why: `an agent is ${AGENT_STATES.join(' | ')}` };
      const a = await this.agentOf(String(msg.agent || ''));
      if (!a) return { t: 'error', why: 'no such agent here' };
      if (msg.state === 'removed') await this.ctx.storage.delete(`agent:${a.id}`);
      else await this.ctx.storage.put(`agent:${a.id}`, { ...a, state: msg.state });
      /* block and remove take effect at once: the agent's plans that are not running go from every device */
      if (msg.state !== 'accepted') {
        for (const p of await this.plans()) {
          if (p.agent.id === a.id && !['running', 'paused'].includes(p.state)) await this.withdraw(p.id, `agent ${msg.state}`);
        }
      }
      this.tell({ ev: 'agent', agent: { ...a, state: msg.state } });
      return { t: 'mcp', ev: 'ok', op: 'agent' };
    }
    if (msg.op === 'plan') {
      const plan = await this.ctx.storage.get(`plan:${String(msg.plan || '')}`);
      if (!plan) return { t: 'error', why: 'no such plan here' };
      const r = await this.env.AGENTS.get(this.env.AGENTS.idFromName(plan.agent.id)).fromRoom(roomId, msg);
      if (!r.ok) return { t: 'error', why: r.why };
      if (msg.state) plan.state = msg.state;
      for (const x of Array.isArray(msg.results) ? msg.results : []) plan.results = { ...plan.results, [x.item]: x };
      await this.ctx.storage.put(`plan:${plan.id}`, plan);
      this.tell({ ev: 'plan', plan });
      return { t: 'mcp', ev: 'ok', op: 'plan' };
    }
    return { t: 'error', why: `unknown mcp-re op ${JSON.stringify(msg.op)}` };
  }

  /* close the sockets that never joined in time; come back while any are still waiting */
  async alarm() {
    const now = Date.now();
    let waiting = false;
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment();
      if (!a || a.device) continue;
      if (now - a.since >= JOIN_WITHIN_MS) ws.close(4408, 'no join in time');
      else waiting = true;
    }
    if (waiting) await this.ctx.storage.setAlarm(now + JOIN_WITHIN_MS);
  }
}

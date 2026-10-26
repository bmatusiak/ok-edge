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
 *   anything else      the web app (docs/, the static build), one page for every route.
 * The MCP face (agents) joins in M5.
 *
 * HIBERNATION: the room accepts its sockets through the Durable Object's hibernation API, so a quiet room is evicted
 * from memory and costs nothing while its devices stay connected; each socket's state lives in its attachment, not in
 * the object. Pings are answered by the runtime itself (an auto-response) without waking the room.
 */
import { DurableObject } from 'cloudflare:workers';
import bucketLib from 'node-onlykey-lib/bucket';
import bytes from 'node-onlykey-lib/bytes';

const { room } = bucketLib;
const ROOM_PATH = /^\/ws\/([0-9a-f]{32})$/;
/* the largest frame passed on: a first sync of post-quantum keys is ~240 KB; room to spare, never unbounded */
const MAX_FRAME = 4 * 1024 * 1024;
/* a socket that has not joined by then is closed: an open connection with no proof holds nothing open for long */
const JOIN_WITHIN_MS = 30_000;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
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

  /* the devices that have joined: [socket, attachment] */
  joined() {
    return this.ctx.getWebSockets().map((ws) => [ws, ws.deserializeAttachment()]).filter(([, a]) => a && a.device);
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
      /* one socket per device: a device that reconnects replaces its old socket */
      for (const [old, a] of this.joined()) if (a.device.id === check.device.id) old.close(4409, 'replaced');
      const peers = this.joined().filter(([old]) => old !== ws).map(([, a]) => a.device);
      ws.serializeAttachment({ ...me, device: check.device, nonce: null });
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
      default:
        return send(ws, { t: 'error', why: `unknown message ${JSON.stringify(msg && msg.t)}` });
    }
  }

  async webSocketClose(ws) {
    this.left(ws);
  }

  async webSocketError(ws) {
    this.left(ws);
  }

  /* a joined device left: the others hear it (a replaced socket's device is still there - nothing to say) */
  left(ws) {
    const a = ws.deserializeAttachment();
    if (!a || !a.device) return;
    const still = this.joined().some(([s, b]) => s !== ws && b.device.id === a.device.id);
    if (still) return;
    for (const [other] of this.joined()) if (other !== ws) send(other, { t: 'peer', down: a.device.id });
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

/*
 * THE LOCALHOST SERVICE (a Rectify plugin - the mcp-server's runtime in plain Node; Brad, 2026-11-01: "localhost running
 * local without the cloudflare overhead"; "so the desktop can re-use the core and websocket to host the mcp and
 * authenticate itself, like it was talking to the remote mcp"; "local only, only need plain, no cert needed").
 *
 * The core's logic on http:// and ws:// at 127.0.0.1 - the same routes as the Worker:
 *   /mcp       the MCP face, for agents on this machine
 *   /ws/<id>   an identity's room: the same challenge and join (the login proof required - REQUIRE_LOGIN '1'), frames,
 *              peers, the agents' room side
 *   /          a plain page naming the server
 * What Cloudflare gives a Durable Object, given here: storage per room / session / agent (in memory), its sockets with
 * their attachments, its alarm as a timer. No SQLite: this server keeps no sealed copy (the desktop's bucket stays in its
 * own file), and the room says so ({on: false}).
 *
 *   mcpLocalhost.start({host = '127.0.0.1', port = 0, env = {}}) -> {url, port, close()}
 */
import http from 'node:http';
import WS from 'ws';

/* ws 7 (React Native's, in this repo) names it Server; ws 8 WebSocketServer - and neither has ESM named exports */
const WebSocketServer = WS.WebSocketServer || WS.Server;

const clone = (v) => (v === undefined ? undefined : structuredClone(v));

/* what Cloudflare's ctx.storage gives the core: key-value, and one alarm (fire is set by the namespace) */
function memoryStorage() {
  const kv = new Map();
  let alarmAt = null;
  let timer = null;
  const storage = {
    fire: null,
    async get(k) { return clone(kv.get(k)); },
    async put(k, v) { kv.set(k, clone(v)); },
    async delete(k) { return kv.delete(k); },
    async deleteAll() { kv.clear(); },
    async list({ prefix = '' } = {}) { return new Map([...kv].filter(([k]) => k.startsWith(prefix)).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => [k, clone(v)])); },
    async getAlarm() { return alarmAt; },
    async setAlarm(at) {
      alarmAt = at;
      clearTimeout(timer);
      timer = setTimeout(() => { alarmAt = null; if (storage.fire) storage.fire(); }, Math.max(0, at - Date.now()));
      if (timer.unref) timer.unref();
    },
    stop() { clearTimeout(timer); },
  };
  return storage;
}

/* a namespace of instances by name, as env.ROOMS / AGENTS / MCP_SESSIONS - each with a ctx of its own */
function namespace(Core, env, all) {
  const made = new Map();
  return {
    idFromName: (name) => String(name),
    get(id) {
      if (!made.has(id)) {
        const storage = memoryStorage();
        const sockets = new Set();
        const ctx = { storage, sockets, acceptWebSocket: (ws) => sockets.add(ws), getWebSockets: () => [...sockets] };
        const core = new Core(ctx, env);
        if (typeof core.alarm === 'function') storage.fire = () => core.alarm().catch(() => undefined);
        made.set(id, core);
        all.push(storage);
      }
      return made.get(id);
    },
  };
}

/* a Node socket as the core handles a Durable Object's: its attachment kept on it */
function attachable(ws) {
  let att = null;
  ws.serializeAttachment = (v) => { att = clone(v); };
  ws.deserializeAttachment = () => clone(att);
  return ws;
}

/* a Node request as a fetch Request (the MCP face takes one), its answer written back */
async function asRequest(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : null;
  return new Request(`http://${req.headers.host}${req.url}`, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? null : body });
}
async function writeResponse(res, response) {
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}

export default function setup(imports, register) {
  const { mcpCore } = imports;
  register(null, {
    mcpLocalhost: {
      start({ host = '127.0.0.1', port = 0, env: settings = {} } = {}) {
        const storages = [];
        const env = { REQUIRE_LOGIN: '1', LIFETIME_IDENTITIES: '*', ...settings };
        env.ROOMS = namespace(mcpCore.RoomCore, env, storages);
        env.AGENTS = namespace(mcpCore.AgentSessionCore, env, storages);
        env.MCP_SESSIONS = namespace(mcpCore.McpSessionCore, env, storages);
        const wss = new WebSocketServer({ noServer: true, maxPayload: 4 * 1024 * 1024 + 1024 });
        const server = http.createServer(async (req, res) => {
          try {
            const path = new URL(req.url, 'http://x').pathname;
            if (path === '/mcp') return writeResponse(res, await mcpCore.handleMcp(await asRequest(req), env));
            if (mcpCore.ROOM_PATH.test(path)) { res.writeHead(426); return res.end('a websocket only'); }
            res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
            return res.end('<!doctype html><title>ok-edge</title><p>The local MCP: /mcp for agents, /ws/&lt;identity&gt; for this computer\'s app.</p>');
          } catch (e) {
            res.writeHead(500);
            res.end(String(e && e.message || e));
          }
        });
        server.on('upgrade', (req, socket, head) => {
          const url = new URL(req.url, `http://${req.headers.host}`);
          const m = mcpCore.ROOM_PATH.exec(url.pathname);
          if (!m) { socket.destroy(); return; }
          wss.handleUpgrade(req, socket, head, (raw) => {
            const ws = attachable(raw);
            const room = env.ROOMS.get(m[1]);
            ws.on('message', (data, isBinary) => {
              const text = isBinary ? null : data.toString('utf8');
              /* pings answered here, as Cloudflare's auto-response does - the room is not asked */
              if (text === '{"t":"ping"}') { ws.send('{"t":"pong"}'); return; }
              room.webSocketMessage(ws, isBinary ? data : text).catch(() => undefined);
            });
            const gone = () => { room.webSocketClose(ws).catch(() => undefined).finally(() => room.ctx.sockets.delete(ws)); };
            ws.on('close', gone);
            ws.on('error', gone);
            room.accept(ws, url).catch(() => ws.close(1011, 'not accepted'));
          });
        });
        return new Promise((resolve, reject) => {
          server.once('error', reject);
          server.listen(port, host, () => {
            const p = server.address().port;
            resolve({
              url: `http://${host}:${p}`,
              port: p,
              close: () => new Promise((done) => {
                for (const s of storages) s.stop();
                for (const c of wss.clients) c.terminate();
                server.close(() => done());
              }),
            });
          });
        });
      },
    },
  });
}
setup.consumes = ['mcpCore'];
setup.provides = ['mcpLocalhost'];

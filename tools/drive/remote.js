'use strict';
/*
 * DRIVE-REMOTE: the drive's hands on the machine the apps run on (Brad, 2026-10-31: "run the server on my host
 * (windows) and the drive-remote on the linux, to manage processes"):
 *
 *   drive server (Windows) <-ws-> drive-remote (this, Linux box) <-> the apps and their processes
 *
 *   127.0.0.1:8790   the apps dial here, as they would dial a local server (src/drive/client.ts) - each connection is
 *                    relayed to the server over its one control connection
 *   0.0.0.0:8791     the drive server dials in (ws://<this machine>:8791/?token=...), with the shared token from
 *                    DRIVE_TOKEN or ~/.onlykey-drive-token - nothing else is accepted there
 *
 * And it starts, stops and restarts the targets here (targets.js) when the server asks. It runs inside the drive app
 * (NW.js, gui/) - one instance per host, its window showing its own lines and every line of every run (Brad: "I hate
 * being blind"). Started by: node tools/drive/launch.js remote
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const EventEmitter = require('events');
const WS = require('ws');
const { createTargets } = require('./targets');

const WebSocketServer = WS.WebSocketServer || WS.Server;
const LOG = path.join(process.env.DRIVE_LOGS || path.join(os.homedir(), 'project/onlykey/logs'), 'drive-remote.log');
/* every line, for the drive app's window */
const bus = new EventEmitter();
let logFile = null;
const line = (t) => { const l = `${new Date().toTimeString().slice(0, 8)} ${t}`; if (logFile) logFile.write(`${l}\n`); bus.emit('line', l); };

let server = null; /* the drive server's control connection */
const apps = new Map(); /* cid -> the app's socket */
let nextCid = 1;
const toServer = (o) => { if (server && server.readyState === 1) server.send(JSON.stringify(o)); };

function start({ appPort = 8790, controlPort = 8791 } = {}) {
  const token = (process.env.DRIVE_TOKEN || (() => { try { return fs.readFileSync(path.join(os.homedir(), '.onlykey-drive-token'), 'utf8'); } catch { return ''; } })()).trim();
  try { fs.mkdirSync(path.dirname(LOG), { recursive: true }); } catch { /* the window still has it */ }
  logFile = fs.createWriteStream(LOG, { flags: 'a' });
  if (!token) { line('no token - set DRIVE_TOKEN or write ~/.onlykey-drive-token (the server uses the same); nothing started'); return; }
  /* a command's output (a build, the CLI) as it runs: to the server, for its tab in the drive window */
  const targets = createTargets(line, (shell, l) => toServer({ t: 'app-out', shell, line: l }), (name, ev) => toServer({ t: 'cmd', name, ev }));

  /* ---- the server's side */
  const controlHttp = http.createServer();
  controlHttp.on('error', (e) => line(`the server's port ${controlPort}: ${e.message}`));
  const control = new WebSocketServer({ server: controlHttp.listen(controlPort, '0.0.0.0') });
  control.on('connection', (ws, req) => {
    const given = new URL(req.url, 'http://x').searchParams.get('token');
    if (given !== token) { ws.close(4001, 'token'); line(`refused a server from ${req.socket.remoteAddress}: wrong token`); return; }
    if (server) { try { server.close(); } catch { /* replaced */ } }
    server = ws;
    line(`drive server connected from ${req.socket.remoteAddress}`);
    ws.send(JSON.stringify({ t: 'remote-hello', machine: os.hostname(), targets: targets.list }));
    /* the apps already here are announced again: their connections live on through a server restart */
    for (const cid of apps.keys()) toServer({ t: 'app-open', cid });
    ws.on('message', async (data) => {
      let m;
      try { m = JSON.parse(String(data)); } catch { return; }
      if (m.t === 'app-msg') { const a = apps.get(m.cid); if (a && a.readyState === 1) a.send(m.data); }
      else if (m.t === 'app-close') { const a = apps.get(m.cid); if (a) a.close(); }
      else if (m.t === 'line') line(m.line);
      else if (m.t === 'fill-file') {
        /* a secret from a file HERE, handed to the app here - the drive server sees only the app's answer, and its length is all that is logged */
        const a = apps.get(m.cid);
        let v = null, why = null;
        try { v = fs.readFileSync(m.file, 'utf8'); if (m.key) v = JSON.parse(v)[m.key]; } catch (e) { why = e.message; }
        if (!why && (typeof v !== 'string' || !v)) why = 'nothing in that file';
        if (why || !a) { toServer({ t: 'app-msg', cid: m.cid, data: JSON.stringify({ t: 'reply', id: m.id, ok: false, why: why || 'the app is gone' }) }); }
        else { line(`fill "${m.field}" from ${m.file} (${v.length} chars)`); a.send(JSON.stringify({ t: 'fill', id: m.id, field: m.field, value: v })); }
      }
      else if (m.t === 'proc') {
        line(`${m.action} ${m.target}`);
        const r = await targets.act(m.action, m.target, m.args || {}).catch((e) => ({ ok: false, why: e.message }));
        /* last words are long: the server keeps them; here, their size */
        line(`${m.action} ${m.target}: ${!r.ok ? r.why : m.action === 'last-words' ? `${String(r.what).split('\n').length} lines sent` : r.what}`);
        toServer({ t: 'proc-reply', id: m.id, ...r });
      }
    });
    ws.on('close', () => { if (server === ws) server = null; line('drive server gone'); });
  });

  /* ---- the apps' side: each connection relayed, opened and closed with it */
  /* a plain request (an app's net check, #4) gets an answer, not a hang: the port is for the apps' sockets */
  const appHttp = http.createServer((req, res) => { res.writeHead(204); res.end(); });
  appHttp.on('error', (e) => line(`the apps' port ${appPort}: ${e.message}`));
  const appSide = new WebSocketServer({ server: appHttp.listen(appPort, '127.0.0.1') });
  appSide.on('connection', (ws) => {
    if (!server) { ws.close(4002, 'no drive server'); return; } /* the app dials again (client.ts) */
    const cid = nextCid++;
    apps.set(cid, ws);
    toServer({ t: 'app-open', cid });
    ws.on('message', (data) => toServer({ t: 'app-msg', cid, data: String(data) }));
    ws.on('close', () => { apps.delete(cid); toServer({ t: 'app-close', cid }); });
  });

  line(`drive-remote on ${os.hostname()}: apps on 127.0.0.1:${appPort}, the server on :${controlPort} - targets ${targets.list.join(', ')}`);
}

/* the window's picture button: the drive server asks the apps (it saves and logs the pictures) */
function shotNow() {
  if (!server || server.readyState !== 1) { line('no drive server - no picture'); return; }
  line('picture asked - the drive server saves it');
  toServer({ t: 'shot-now' });
}

/* what the window shows */
function status() {
  return { server: !!(server && server.readyState === 1), apps: apps.size };
}

module.exports = { start, bus, status, shotNow };

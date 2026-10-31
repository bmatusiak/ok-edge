#!/usr/bin/env node
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
 * And it starts, stops and restarts the targets here (tools/drive/targets.js) when the server asks. The lines of every
 * run come back here too and are printed - the box screen's window shows them (Brad: "I hate being blind").
 *
 *   node tools/drive/remote.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const WS = require('ws');
const { createTargets } = require('./targets');

const WebSocketServer = WS.WebSocketServer || WS.Server;
const APP_PORT = Number(process.env.DRIVE_PORT || 8790);
const CONTROL_PORT = Number(process.env.DRIVE_REMOTE_PORT || 8791);
const TOKEN = (process.env.DRIVE_TOKEN || (() => { try { return fs.readFileSync(path.join(os.homedir(), '.onlykey-drive-token'), 'utf8'); } catch { return ''; } })()).trim();
if (!TOKEN) { console.error('drive-remote: no token - set DRIVE_TOKEN or write ~/.onlykey-drive-token (the server uses the same)'); process.exit(2); }

const LOG = path.join(process.env.DRIVE_LOGS || path.join(os.homedir(), 'project/onlykey/logs'), 'drive-remote.log');
const logFile = fs.createWriteStream(LOG, { flags: 'a' });
const line = (t) => { const l = `${new Date().toTimeString().slice(0, 8)} ${t}`; process.stdout.write(`${l}\n`); logFile.write(`${l}\n`); };

const targets = createTargets();
let server = null; /* the drive server's control connection */
const apps = new Map(); /* cid -> the app's socket */
let nextCid = 1;
const toServer = (o) => { if (server && server.readyState === 1) server.send(JSON.stringify(o)); };

/* ---- the server's side */
const control = new WebSocketServer({ server: http.createServer().listen(CONTROL_PORT, '0.0.0.0') });
control.on('connection', (ws, req) => {
  const token = new URL(req.url, 'http://x').searchParams.get('token');
  if (token !== TOKEN) { ws.close(4001, 'token'); line(`refused a server from ${req.socket.remoteAddress}: wrong token`); return; }
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
    else if (m.t === 'proc') {
      line(`${m.action} ${m.target}`);
      const r = await targets.act(m.action, m.target).catch((e) => ({ ok: false, why: e.message }));
      line(`${m.action} ${m.target}: ${r.ok ? r.what : r.why}`);
      toServer({ t: 'proc-reply', id: m.id, ...r });
    }
  });
  ws.on('close', () => { if (server === ws) server = null; line('drive server gone'); });
});

/* ---- the apps' side: each connection relayed, opened and closed with it */
const appSide = new WebSocketServer({ server: http.createServer().listen(APP_PORT, '127.0.0.1') });
appSide.on('connection', (ws) => {
  if (!server) { ws.close(4002, 'no drive server'); return; } /* the app dials again on its own activity */
  const cid = nextCid++;
  apps.set(cid, ws);
  toServer({ t: 'app-open', cid });
  ws.on('message', (data) => toServer({ t: 'app-msg', cid, data: String(data) }));
  ws.on('close', () => { apps.delete(cid); toServer({ t: 'app-close', cid }); });
});

line(`drive-remote on ${os.hostname()}: apps on 127.0.0.1:${APP_PORT}, the server on :${CONTROL_PORT} - targets ${targets.list.join(', ')}`);

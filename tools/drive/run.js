#!/usr/bin/env node
'use strict';
/*
 * Ask the drive server to run a script (tools/drive/scripts/<name>.js) against a connected app, and show every line
 * of it as it comes. Exits with the run's code.
 *   node tools/drive/run.js <script> [--app desktop|webapp|android] [args...]
 * From Git Bash, file arguments for another machine need MSYS_NO_PATHCONV=1 - else /home/... reaches node as
 * C:/Program Files/Git/home/...
 */
const WebSocket = require('ws');

/* everything after "--" goes to the script untouched (run.js cli --app desktop -- edge status --test-mode) */
const all = process.argv.slice(2);
const dd = all.indexOf('--');
const argv = dd >= 0 ? all.slice(0, dd) : all;
const passed = dd >= 0 ? all.slice(dd + 1) : [];
const at = argv.indexOf('--app');
const app = at >= 0 ? argv[at + 1] : undefined;
const rest = at >= 0 ? argv.filter((_, i) => i !== at && i !== at + 1) : argv;
const [script, ...own] = rest;
const args = [...own, ...passed];
if (!script) { console.error('usage: run.js <script> [--app desktop|webapp|android] [args...]'); process.exit(2); }

const ws = new WebSocket(`ws://127.0.0.1:${process.env.DRIVE_PORT || 8790}/control`);
ws.on('open', () => ws.send(JSON.stringify({ t: 'run', script, app, args })));
ws.on('message', (data) => {
  const m = JSON.parse(String(data));
  if (m.t === 'line') console.log(m.line);
  /* a query's answer: to this caller only, never drawn in the drive windows (server.js driveFor) */
  if (m.t === 'answer') for (const l of m.lines) console.log(l);
  if (m.t === 'end') { ws.close(); process.exit(m.code); }
});
ws.on('error', (e) => { console.error(`drive: no server (${e.message}) - start the drive app: node tools/drive/launch.js server [--remote ws://<box>:8791]`); process.exit(1); });
/* the server ending the run is the end; a server that went away is one too */
ws.on('close', () => process.exit(1));

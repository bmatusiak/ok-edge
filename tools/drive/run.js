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
/*
 * FAIL FAST, ALWAYS (Brad, 2026-11-03: "fail fast should be default, it should always pass on the first try, and
 * --fail-retry N should be in place for retries" - after a login looped on a press never given): the run stops at its
 * first press not made or not answered, a login state come back, a retry block's first failure (server.js control).
 * --fail-retry N lets N of those go by.
 */
const fr = argv.indexOf('--fail-retry');
const failRetry = fr >= 0 ? Number(argv[fr + 1]) : 0;
if (!Number.isInteger(failRetry) || failRetry < 0) { console.error('--fail-retry N: N a whole number, 0 or more'); process.exit(2); }
const rest = (at >= 0 ? argv.filter((_, i) => i !== at && i !== at + 1) : argv).filter((_, i, all) => all[i] !== '--fail-retry' && all[i - 1] !== '--fail-retry');
const [script, ...own] = rest;
const args = [...own, ...passed];
if (!script) { console.error('usage: run.js <script> [--app desktop|webapp|android] [args...]'); process.exit(2); }

/*
 * NOBODY LISTENING, SAID FIRST (Brad, 2026-11-01: "your watcher is not armed, your waiting on nothing"; "does drive need a
 * skill to remind you to have a watcher?" - a skill only loads when asked for, so the reminder is here, on every run):
 * the agent running this hears Brad's "I see no activity" and his pictures only through a wake watcher (wake.js, under a
 * Monitor). None running -> the first line of every run says so, loudly. (wake-mark.js knows; doctor says it too.)
 */
if (!require('./wake-mark').wakeWatcher()) {
  console.log(`!!! NO WAKE WATCHER - Brad's "I see no activity" and pictures reach nobody. ${require('./wake-mark').ARM}`);
}

const ws = new WebSocket(`ws://127.0.0.1:${process.env.DRIVE_PORT || 8790}/control`);
ws.on('open', () => ws.send(JSON.stringify({ t: 'run', script, app, args, failRetry })));
ws.on('message', (data) => {
  const m = JSON.parse(String(data));
  if (m.t === 'line') console.log(m.line);
  /* a query's answer: to this caller only, never drawn in the drive windows (server.js driveFor) */
  if (m.t === 'answer') for (const l of m.lines) console.log(l);
  /* the run's end: its verdict and where its lines are (grep that file - the lines are not sent here) */
  if (m.t === 'end') {
    const k = m.keys && (m.keys.requests || m.keys.presses) ? ` · ${m.keys.requests} key request(s) without a press, ${m.keys.presses} press(es)` : '';
    console.log(`${script} ${m.code === 0 ? 'FINISHED' : `STOPPED: ${m.reason || ''}`} · ${Math.round((m.ms || 0) / 1000)} s${k} · ${m.lines || 0} lines: ${m.file || '(not kept)'}`);
    ws.close();
    process.exit(m.code);
  }
});
ws.on('error', (e) => { console.error(`drive: no server (${e.message}) - start the drive app: node tools/drive/launch.js server [--remote ws://<box>:8791]`); process.exit(1); });
/* the server ending the run is the end; a server that went away is one too */
ws.on('close', () => process.exit(1));

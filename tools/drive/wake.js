#!/usr/bin/env node
'use strict';
/*
 * WAKE THE AGENT ON A DRIVE EVENT (Brad, 2026-10-31: "can you hook monitor into drive so it can wake you, you control the
 * flags what does"): follows the drive server's log (server.js LOG - every line of the server, its apps and its remotes)
 * from its end and prints ONE short line per event of the kinds switched on - each printed line is a notification to
 * whoever runs this under a Monitor. Nothing else is printed, so a quiet drive costs nothing.
 *   node tools/drive/wake.js [--on picture,bootloader,error,app] [--all] [--list]
 * Events only: fs.watch on the log, the new bytes read as they land (a log that shrank is read from its start).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const LOG = process.env.DRIVE_LOG || path.join(os.homedir(), 'drive-logs', 'drive-server.log');
/* each kind: what wakes, matched against one drive line */
const KINDS = {
  picture: /picture asked from the .+ window|\] picture: .*-seen-by-(?!error)/, /* Brad's "Picture now", with its files */
  bootloader: /BOOTLOADER MODE|left bootloader mode/,                          /* a key in HalfKay, and out of it */
  error: /\] ERROR |\bFATAL\b|unhandled rejection/,                             /* an app's error, crash or LogBox */
  app: /app connected|app disconnected|drive server gone|remote .* (connected|gone)/, /* apps and remotes coming and going */
  /* a change the key monitor saw ("hard (usb …", "no OnlyKey") - not run.js keys' own answer ("hard key - usb …") */
  keys: /\[keys\] [^:]+: (no OnlyKey|[a-z]+ \((usb|OnlyKey) )/,
  /* a drive script ending - not the agent's own queries (log, state, find, doctor, shot): those it already waits on */
  run: /\[(?!(log|state|find|doctor|shot)\])[a-z-]+\] (STOPPED|FINISHED)\b/,
  press: /\] pressed: /,                                                         /* a press the drive made */
  user: /USER DOES NOT SEE ACTIVITY/,                                            /* Brad's "I see no activity" button */
  failed: /\] key request failed: /,                                             /* an app's key request that stopped (server.js) */
};
/* a run ending and a request failing wake by default (Brad, 2026-11-01: "need a better way for you to know when things stop") */
const DEFAULT = ['picture', 'bootloader', 'error', 'app', 'user', 'run', 'failed'];

const args = process.argv.slice(2);
if (args.includes('--list')) { for (const [k, re] of Object.entries(KINDS)) console.log(`${k.padEnd(11)} ${re}`); process.exit(0); }
const i = args.indexOf('--on');
const on = args.includes('--all') ? Object.keys(KINDS) : i >= 0 ? String(args[i + 1] || '').split(',').filter(Boolean) : DEFAULT;
const unknown = on.filter((k) => !KINDS[k]);
if (unknown.length) { console.error(`unknown kind(s): ${unknown.join(', ')} - known: ${Object.keys(KINDS).join(', ')}`); process.exit(2); }

let at = fs.existsSync(LOG) ? fs.statSync(LOG).size : 0;
let rest = '';
function read() {
  let size;
  try { size = fs.statSync(LOG).size; } catch { return; }
  if (size < at) { at = 0; rest = ''; } /* a new log */
  if (size === at) return;
  const fd = fs.openSync(LOG, 'r');
  const buf = Buffer.alloc(size - at);
  fs.readSync(fd, buf, 0, buf.length, at);
  fs.closeSync(fd);
  at = size;
  const lines = (rest + buf.toString('utf8')).split('\n');
  rest = lines.pop();
  for (const l of lines) {
    const kind = on.find((k) => KINDS[k].test(l));
    if (kind) console.log(`[wake:${kind}] ${l.trim().slice(0, 220)}`);
  }
}
fs.mkdirSync(path.dirname(LOG), { recursive: true });
/* the mark that says a watcher runs (wake-mark.js): run.js doctor and the no-activity button read it */
require('./wake-mark').markWatching(on);
fs.watch(path.dirname(LOG), (e, name) => { if (!name || name === path.basename(LOG)) read(); });
console.error(`wake: following ${LOG} for ${on.join(', ')}`);

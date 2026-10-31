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
  keys: /\[keys\] [^:]+: (?!.*start on)/,                                        /* any change in the keys on a machine */
  run: /\[[a-z-]+\] (STOPPED|FINISHED)\b/,                                       /* a drive script ending */
  press: /\] pressed: /,                                                         /* a press the drive made */
};
const DEFAULT = ['picture', 'bootloader', 'error', 'app'];

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
fs.watch(path.dirname(LOG), (e, name) => { if (!name || name === path.basename(LOG)) read(); });
console.error(`wake: following ${LOG} for ${on.join(', ')}`);

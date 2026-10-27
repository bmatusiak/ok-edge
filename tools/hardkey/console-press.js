#!/usr/bin/env node
'use strict';
/*
 * PRESS A DEVELOPER HARD KEY'S BUTTONS FROM THIS COMPUTER - its debug console (SEREMU, usage page 0xffc9), the way the
 * onlykey-testing kit presses it on Linux and the lib's device.press() does (src/device/console.js pressLine): one
 * line of button digits, sent as 32-byte out-reports, zero-padded, behind the report ID (cli/transport-hid.js
 * writeSeremu - Windows refuses any other length). Works on Windows and Linux; a DEBUG build only (a release key has
 * no console). Testnet keys only: this is automation, never a live key's presses.
 *
 *   node tools/hardkey/console-press.js 1          press button 1
 *   node tools/hardkey/console-press.js 1111111    a PIN, as one line (the firmware queues the presses)
 *
 * node-hid: the lib's copy (it keeps node-hid optional; this computer has it), else the kit's.
 */
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..');
let HID;
for (const p of ['node-onlykey-lib/node_modules/node-hid', 'onlykey-testing/node_modules/node-hid']) {
  try { HID = require(path.join(ROOT, p)); break; } catch (_) { /* the next */ }
}
if (!HID) { console.error('console-press: no node-hid (node-onlykey-lib or onlykey-testing node_modules)'); process.exit(2); }

const line = process.argv[2];
if (!line || !/^[1-6]+$/.test(line)) { console.error('usage: node tools/hardkey/console-press.js <buttons 1-6, e.g. 1 or 1111111>'); process.exit(2); }
const info = HID.devices().find((d) => d.vendorId === 0x1d50 && d.usagePage === 0xffc9);
if (!info) { console.error('console-press: no OnlyKey debug console here (a DEBUG build, plugged in)'); process.exit(1); }

const dev = new HID.HID(info.path);
const bytes = Buffer.from(`${line}\n`, 'latin1');
for (let at = 0; at < bytes.length; at += 32) {
  const report = Buffer.alloc(32);
  bytes.copy(report, 0, at, at + 32);
  dev.write([0, ...report]);
}
dev.close();
console.log(`console-press: pressed ${line}`);

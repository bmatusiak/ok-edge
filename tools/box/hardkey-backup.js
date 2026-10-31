#!/usr/bin/env node
'use strict';
/*
 * A TEST hard key's backup, as the key types it (button 1 held - the backup a person would paste), captured by the
 * kit's keyboard capture and written to a file - for the box's restore tests (2026-10-31: key 2's backup onto the box
 * desktop app's soft key, then wiped and restored again: three devices in one log). Never a live key: a production
 * build has no debug console for the kit, and the file it writes holds the key's secrets (encrypted under its backup
 * passphrase) - it goes to a 0600 file in a 0700 folder, never to a log.
 *
 *   node tools/box/hardkey-backup.js <out.txt>      the key must already have its backup passphrase (the kit's) set
 */
const path = require('path');
const os = require('os');
const fs = require('fs');

const KIT = process.env.KIT || path.join(os.homedir(), 'project/onlykey/onlykey-testing');
const { Device } = require(`${KIT}/lib/device`);
const { HardwareTransport } = require(`${KIT}/lib/device/hardware`);
const { detect } = require(`${KIT}/lib/capabilities`);
const { PINS } = require(`${KIT}/lib/config`);
const backup = require(`${KIT}/lib/device/backup`);

const out = process.argv[2];
if (!out) { console.error('usage: hardkey-backup.js <out.txt>'); process.exit(2); }
const say = (s) => console.log(`== ${new Date().toTimeString().slice(0, 8)} ${s}`);

(async () => {
  const transport = new HardwareTransport();
  transport.on('selected', (d) => { if (d.gadget) { say('EMULATOR GADGET - not a hard key, stopping'); process.exit(2); } });
  const device = new Device(transport, { capabilities: detect({ adapter: 'hardware' }) });
  await transport.start();
  await device.waitReady();
  await device.ensureUnlocked(PINS.primary);
  let started = false;
  for (let attempt = 1; attempt <= 6 && !started; attempt++) {
    device.log.clear();
    device.keys.clear();
    device.pressLine([{ button: 1, hold: 'hold' }]);
    started = await Promise.any([
      device.log.waitFor(/Backing up Label Number/, { timeoutMs: 5000 }),
      device.waitKeystrokes(/-----BEGIN ONLYKEY BACKUP-----/, { timeoutMs: 5000 }),
    ]).then(() => true, () => device.keystrokes.length > 0);
  }
  if (!started) throw new Error('the key never started a backup (is a backup passphrase set?)');
  await device.waitKeystrokes(/-----END ONLYKEY BACKUP-----/, { timeoutMs: 600000 });
  const text = device.keystrokes;
  const parsed = backup.parse(text);
  if (!parsed.complete || !backup.verify(parsed)) throw new Error(`the typed backup does not check (${parsed.lines} lines)`);
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true, mode: 0o700 });
  fs.writeFileSync(out, text.slice(text.indexOf('-----BEGIN ONLYKEY BACKUP-----')), { mode: 0o600 });
  say(`backup: ${parsed.data.length} bytes, ${parsed.lines} lines, its hash checks - written to ${out}`);
  await transport.stop();
  process.exit(0);
})().catch((e) => { console.error(`hardkey-backup: ${e && e.message}`); process.exit(1); });

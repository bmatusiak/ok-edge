#!/usr/bin/env node
'use strict';
/*
 * hardkey-restart.js - restart a HARD key on this computer's USB through its DEBUG console, then unlock it with the kit's
 * PIN - a test hex set up by the kit only (a production build has no console: only a person replugs it).
 *
 *   node tools/box/hardkey-restart.js            restart, unlock, print its status line
 *   KIT=<onlykey-testing> node ...               the kit's checkout (default ~/project/onlykey/onlykey-testing)
 *
 * Why (box, 2026-10-29): after a derive_secret request timed out waiting for its 3-button code, key 2 kept answering
 * every tunnel request out of step ("a stale reply ... CTAP1_SUCCESS") while its USB status read fine. A restart clears
 * the key's request state; no sudo on the box to reset the port, and no hands needed.
 */
const path = require('path');
const os = require('os');

const KIT = process.env.KIT || path.join(os.homedir(), 'project/onlykey/onlykey-testing');
const { Device } = require(`${KIT}/lib/device`);
const { HardwareTransport } = require(`${KIT}/lib/device/hardware`);
const { detect } = require(`${KIT}/lib/capabilities`);
const { PINS } = require(`${KIT}/lib/config`);

const say = (s) => console.log(`== ${new Date().toTimeString().slice(0, 8)} ${s}`);
/* a probe the kit leaves running while the key restarts is not this run's failure */
process.on('unhandledRejection', (e) => say(`(a stray probe: ${e && e.message})`));

(async () => {
  const transport = new HardwareTransport();
  transport.on('selected', (d) => say(`device: ${d.gadget ? 'EMULATOR GADGET - not a hard key, stopping' : 'hard key'} at ${d.usbPath}`));
  const device = new Device(transport, { capabilities: detect({ adapter: 'hardware' }) });
  await transport.start();
  await device.waitReady();
  say(`before: ${(await device.status()).raw}`);
  await device.restart();
  say('restarted');
  await device.ensureUnlocked(PINS.primary);
  say(`after: ${(await device.status()).raw}`);
  await transport.stop();
  process.exit(0);
})().catch((e) => { console.error(`FAILED: ${e && e.message}`); process.exit(1); });

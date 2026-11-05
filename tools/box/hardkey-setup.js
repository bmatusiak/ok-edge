#!/usr/bin/env node
'use strict';
/*
 * A FRESHLY FLASHED TEST KEY, SET UP: the kit's 'initialized' state (lib/fixtures - PINs 1111111 / 2222222, its
 * self-destruct 6666666), typed through the key's DEBUG console, as every kit run on a hard key does. A developer flash
 * wipes the key, so a test key flashed by `run.js flash test` comes here next. A key already set up is left as it is.
 *
 * Test hex only: a production key has no console, so only a person's fingers set it up. The gadget is skipped (it is a
 * soft key with its own setup), and the box's desktop app must be stopped first - it holds the hard key's replies.
 *
 *   node tools/box/hardkey-setup.js
 */
const path = require('path');
const os = require('os');

const KIT = process.env.KIT || path.join(os.homedir(), 'project/onlykey/onlykey-testing');
const { Device } = require(`${KIT}/lib/device`);
const { HardwareTransport } = require(`${KIT}/lib/device/hardware`);
const { detect } = require(`${KIT}/lib/capabilities`);
const { ensureOnDevice } = require(`${KIT}/lib/fixtures`);

(async () => {
  const transport = new HardwareTransport();
  transport.on('selected', (d) => { if (d.gadget) { console.log('EMULATOR GADGET - not a hard key, stopping'); process.exit(2); } });
  const device = new Device(transport, { capabilities: detect({ adapter: 'hardware' }) });
  await transport.start();
  await device.waitReady();
  const r = await ensureOnDevice('initialized', device, { log: (m) => console.log(m) });
  console.log(r.applied ? 'set up: initialized (PIN 1111111)' : 'already set up: initialized');
  await transport.stop();
  process.exit(0);
})().catch((e) => { console.error(`hardkey-setup: ${e && e.stack || e}`); process.exit(1); });

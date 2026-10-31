#!/usr/bin/env node
'use strict';
/*
 * ERASE A TEST HARD KEY'S EDGE STATE (OKEDGE_WIPE_DEBUG, DEBUG builds only - a production key answers it as unknown):
 * both state sectors, every budget, the chain. The next Edge request starts a new chain at #0 with a new device salt.
 * For the box's key 2 when no computer holds its chain any more: the key never reveals its head and its ring keeps 8
 * links, so a key past #8 with every copy lost can open no budget anywhere (2026-10-31, key 2 at #39). Testnet only.
 *
 * Over the kit's hardware transport, as owner-key.js. Prints the device id and seq before and after.
 *   node tools/box/hardkey-edge-wipe.js
 */
const path = require('path');
const os = require('os');

const KIT = process.env.KIT || path.join(os.homedir(), 'project/onlykey/onlykey-testing');
const { Device } = require(`${KIT}/lib/device`);
const { HardwareTransport } = require(`${KIT}/lib/device/hardware`);
const { detect } = require(`${KIT}/lib/capabilities`);
const { PINS } = require(`${KIT}/lib/config`);
const LIB = process.env.OKT_LIB_DIR = process.env.OKT_LIB_DIR || path.join(os.homedir(), 'project/onlykey/node-onlykey-lib');
const { composeLib } = require(`${KIT}/lib/libstack`);

const hex = (b) => Buffer.from(b).toString('hex');

(async () => {
  const transport = new HardwareTransport();
  transport.on('selected', (d) => { if (d.gadget) { console.log('EMULATOR GADGET - not a hard key, stopping'); process.exit(2); } });
  const device = new Device(transport, { capabilities: detect({ adapter: 'hardware' }) });
  await transport.start();
  await device.waitReady();
  await device.ensureUnlocked(PINS.primary);
  const lib = await composeLib(device);
  let edge = null;
  require(path.join(LIB, 'edge/plugin'))({ transport: lib.services.transport }, (err, s) => { if (err) throw err; edge = s.edge; });
  const show = async (when) => {
    const h = await edge.head();
    const { deviceId } = await edge.publicKey();
    console.log(`${when}: device ${hex(deviceId)} seq ${h.seq}`);
  };
  await show('before');
  await edge.wipeDebug();
  await show('after');
  await transport.stop();
  process.exit(0);
})().catch((e) => { console.error(`hardkey-edge-wipe: ${e && e.stack || e}`); process.exit(1); });

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
const fs = require('fs');
const path = require('path');
const os = require('os');

/* the box's layout (~/project/onlykey), else the repos beside this ok-edge checkout (Windows) */
const sibling = (name) => [path.join(os.homedir(), 'project/onlykey', name), path.resolve(__dirname, '../../..', name)].find((p) => fs.existsSync(p));
const KIT = process.env.KIT || sibling('onlykey-testing');
const { Device } = require(`${KIT}/lib/device`);
const { HardwareTransport } = require(`${KIT}/lib/device/hardware`);
const { detect } = require(`${KIT}/lib/capabilities`);
const { PINS } = require(`${KIT}/lib/config`);
const LIB = process.env.OKT_LIB_DIR = process.env.OKT_LIB_DIR || sibling('node-onlykey-lib');
const { composeLib } = require(`${KIT}/lib/libstack`);

const hex = (b) => Buffer.from(b).toString('hex');

/*
 * EACH STEP SAID, AND NONE WAITS FOREVER (Brad, 2026-10-31: "wipe is fast, your waiting, thats a bug"): it sat 90 s with
 * nothing printed. Every step names itself and has 20 s - a step that runs out says which one, and the run ends.
 */
const step = async (name, p) => {
  console.log(`.. ${name}`);
  let t;
  try {
    return await Promise.race([p, new Promise((_, no) => { t = setTimeout(() => no(new Error(`${name}: no answer in 20 s`)), 20000); })]);
  } finally { clearTimeout(t); }
};

(async () => {
  const transport = new HardwareTransport();
  transport.on('selected', (d) => { if (d.gadget) { console.log('EMULATOR GADGET - not a hard key, stopping'); process.exit(2); } });
  const device = new Device(transport, { capabilities: detect({ adapter: 'hardware' }) });
  await step('open the key', transport.start());
  await step('the key ready', device.waitReady());
  await step('unlock (the kit PIN)', device.ensureUnlocked(PINS.primary));
  const lib = await step('the lib over it', composeLib(device));
  let edge = null;
  require(path.join(LIB, 'edge/plugin'))({ transport: lib.services.transport }, (err, s) => { if (err) throw err; edge = s.edge; });
  const show = async (when) => {
    const h = await edge.head();
    const { deviceId } = await edge.publicKey();
    console.log(`${when}: device ${hex(deviceId)} seq ${h.seq}`);
  };
  await step('before', show('before'));
  await step('wipe', edge.wipeDebug());
  await step('after', show('after'));
  await transport.stop();
  process.exit(0);
})().catch((e) => { console.error(`hardkey-edge-wipe: ${e && e.stack || e}`); process.exit(1); });

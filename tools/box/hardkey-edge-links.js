#!/usr/bin/env node
'use strict';
/*
 * SABOTAGE A HOST'S COPY: LINKS NO APP SEES (Brad, 2026-10-31: "drive desktop app with blue hard key, sabotage the
 * blockchain, and see how it reacts"). Writes N links on a TEST hard key - each a certify of a random subject, pressed
 * through the test hex's debug console - with no app's copy following, so every host's copy falls behind the key's ring
 * once N passes it (8): red-key's state on 2026-10-31 (#1069 lost), made on purpose. The app then has to say the head is
 * out of reach and offer the loss. Close the app on this machine first: it would take the key's replies.
 *
 * Over the kit's hardware transport, as hardkey-edge-wipe.js. A DEBUG (test) hex only - a production key has no console.
 *   node tools/box/hardkey-edge-links.js [N]      (default 10)
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

/* the box's layout (~/project/onlykey), else the repos beside this ok-edge checkout (Windows) */
const sibling = (name) => [path.join(os.homedir(), 'project/onlykey', name), path.resolve(__dirname, '../../..', name)].find((p) => fs.existsSync(p));
const KIT = process.env.KIT || sibling('onlykey-testing');
const { Device } = require(`${KIT}/lib/device`);
const { HardwareTransport } = require(`${KIT}/lib/device/hardware`);
const { detect } = require(`${KIT}/lib/capabilities`);
const { PINS } = require(`${KIT}/lib/config`);
const LIB = process.env.OKT_LIB_DIR = process.env.OKT_LIB_DIR || sibling('node-onlykey-lib');
const { composeLib } = require(`${KIT}/lib/libstack`);

const N = Number(process.argv[2] || 10);
/* each step said, none waits forever (as hardkey-edge-wipe.js) */
const step = async (name, p, ms = 20000) => {
  console.log(`.. ${name}`);
  let t;
  try {
    return await Promise.race([p, new Promise((_, no) => { t = setTimeout(() => no(new Error(`${name}: no answer in ${ms / 1000} s`)), ms); })]);
  } finally { clearTimeout(t); }
};

(async () => {
  if (!Number.isInteger(N) || N < 1 || N > 64) throw new Error('N is 1..64');
  const transport = new HardwareTransport();
  transport.on('selected', (d) => { if (d.gadget) { console.log('EMULATOR GADGET - not a hard key, stopping'); process.exit(2); } });
  const device = new Device(transport, { capabilities: detect({ adapter: 'hardware' }) });
  await step('open the key', transport.start());
  await step('the key ready', device.waitReady());
  await step('unlock (the kit PIN)', device.ensureUnlocked(PINS.primary));
  const lib = await step('the lib over it', composeLib(device));
  let edge = null;
  require(path.join(LIB, 'edge/plugin'))({ transport: lib.services.transport }, (err, s) => { if (err) throw err; edge = s.edge; });
  const before = await step('head before', edge.head());
  for (let i = 1; i <= N; i += 1) {
    /* the press once the request is on the key - 800 ms, as the kit's own Edge tests */
    const c = await step(`certify ${i} of ${N}`, edge.certify(crypto.randomBytes(32), { onPress: () => setTimeout(() => device.press(1), 800) }), 40000);
    console.log(`   link #${c.seq}`);
  }
  const after = await step('head after', edge.head());
  console.log(`done: #${before.seq} -> #${after.seq} (oldest the key still holds: #${after.oldest}) - no app saw these links`);
  await transport.stop();
  process.exit(0);
})().catch((e) => { console.error(`hardkey-edge-links: ${e && e.stack || e}`); process.exit(1); });

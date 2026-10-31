#!/usr/bin/env node
'use strict';
/*
 * WHICH BACKUP IS THIS HARD KEY? Prints its Edge device id, identity id and owner key - all read with no press - so
 * they can be compared with a host's card (`certification.ownerKey`, the identity in `okrn.edge[.test].card.<id>.<dev>`).
 * Two keys restored from one backup share the owner key and identity id; each has its own device id.
 *
 * Over the kit's hardware transport, as hardkey-restart.js: the box's lib has no node-hid (an optional peer, never
 * npm-installed into the lib). Unlocks with the kit PIN first unless --locked.
 *
 *   node tools/box/owner-key.js [--locked]
 */
const path = require('path');
const os = require('os');

const KIT = process.env.KIT || path.join(os.homedir(), 'project/onlykey/onlykey-testing');
const { Device } = require(`${KIT}/lib/device`);
const { HardwareTransport } = require(`${KIT}/lib/device/hardware`);
const { detect } = require(`${KIT}/lib/capabilities`);
const { PINS } = require(`${KIT}/lib/config`);
/* the box's lib checkout, as the kit runs it (OKT_LIB_DIR - composeLib reads it too) */
const LIB = process.env.OKT_LIB_DIR = process.env.OKT_LIB_DIR || path.join(os.homedir(), 'project/onlykey/node-onlykey-lib');
const { composeLib } = require(`${KIT}/lib/libstack`);

const hex = (b) => Buffer.from(b).toString('hex');

(async () => {
  const transport = new HardwareTransport();
  transport.on('selected', (d) => { if (d.gadget) { console.log('EMULATOR GADGET - not a hard key, stopping'); process.exit(2); } });
  const device = new Device(transport, { capabilities: detect({ adapter: 'hardware' }) });
  await transport.start();
  await device.waitReady();
  if (!process.argv.includes('--locked')) await device.ensureUnlocked(PINS.primary);
  const lib = await composeLib(device);
  let edge = null;
  require(path.join(LIB, 'edge/plugin'))({ transport: lib.services.transport }, (err, s) => { if (err) throw err; edge = s.edge; });
  const h = await edge.head();
  const { deviceId } = await edge.publicKey();
  console.log(`device id  ${hex(deviceId)}`);
  const id = await edge.identityId(); /* already hex text */
  console.log(`identity   ${typeof id === 'string' ? id : hex(id)}`);
  console.log(`owner key  ${hex(await edge.ownerPublicKey())}`);
  console.log(`seq        ${h.seq}`);
  await transport.stop();
  process.exit(0);
})().catch((e) => { console.error(`owner-key: ${e && e.stack || e}`); process.exit(1); });

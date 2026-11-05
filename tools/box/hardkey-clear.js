/*
 * A TEST KEY CLEARED AFTER THE TESTING KIT (Brad, 2026-11-05: "clear the key after using the testing kit, then rehearse
 * the setup on the app"; "1111111 does a lot, possibly will leave it dirty - i dont want a dirty key being plugged in
 * the app after its been hammered in the testing kit"). The kit's own 'blank' state, typed through the key's DEBUG
 * console: the userspace wipe ('0C') - every slot, setting, PIN and Edge record gone, the key uninitialized - never the
 * full wipe ('9C'), which also erases the firmware hash and needs a reflash. The app then sets the key up itself
 * (rehearsals/hardkey-setup.yaml - the app's one PIN, 1234561): the app never sees a key the kit left behind.
 *
 * Test hex only: a production key has no console. The gadget is skipped (a soft key with its own wipe), and the box's
 * desktop app must be stopped first - it holds the hard key's replies.
 *
 *   node tools/box/hardkey-clear.js
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
  const r = await ensureOnDevice('blank', device, { log: (m) => console.log(m) });
  console.log(r.applied ? 'cleared: uninitialized (the userspace wipe)' : 'already clear: uninitialized');
  await transport.stop();
  process.exit(0);
})().catch((e) => { console.error(`hardkey-clear: ${e && e.stack || e}`); process.exit(1); });

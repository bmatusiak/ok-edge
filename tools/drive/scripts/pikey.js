'use strict';
/*
 * THE PI RELAY KEY, BY HAND - OPTIONAL (tools/drive/pikey.js): an app's key that is a test soft key on a Raspberry Pi's
 * USB port, its firmware on another machine of the drive's. Off unless ~/.onlykey-drive.json names one.
 *   run.js pikey [state] --app desktop@windows     its LED, its cable, whether its firmware is connected
 *   run.js pikey start | stop --app desktop@windows  its firmware
 *   run.js pikey out | in --app desktop@windows     the cable: the app's computer sees the key unplugged / plugged in
 *   run.js pikey press 1 2 3 --app desktop@windows  its buttons (a testnet key - the drive presses no other)
 */
module.exports = async (d, args) => {
  const op = args[0] || 'state';
  const r = await d.machine(`pikey-${op}`, d.app.shell, op === 'press' ? { buttons: args.slice(1) } : {});
  if (!r.ok) throw new Error(`pikey ${op} (${r.where}): ${r.why}`);
  d.say(`${r.what} (${r.where})`);
};

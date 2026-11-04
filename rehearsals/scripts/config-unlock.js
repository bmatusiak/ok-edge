/*
 * THE PIN AGAIN, THEN "Check config mode" (config-pin-set.yaml): the key locked itself on its way into config mode (PRE -
 * the app's PIN screen with "Check config mode" beside the pad). The gadget's PIN goes in on its buttons from the machine
 * that holds it (as the drive's login does - tools/drive/flows.js unlockOutsideKey), its LED read until green, then the
 * app's check. PIN: the key's own (the drive's testing PIN unless the flow names another).
 */
const GREEN = /led #00[4-9a-f][0-9a-f]00\b/;
const DARK = /led #000000\b/;
/* unlocked IN CONFIG MODE: the LED pulses red, not green (tools/drive/flows.js CONFIG_RED) - the colour this step wants */
const CONFIG_RED = /led #(?!00)[0-9a-f]{2}0000\b/;
const pin = String(typeof PIN === 'undefined' ? '1234561' : PIN);
const s = await drive.machine('key-state');
if (!s.ok) throw new Error(`the key: ${s.why}`);
if (!/\btestnet\b/.test(s.what)) throw new Error(`the key is not a testnet one (${s.what}) - the drive does not press it`);
/* pressed only when dark: a press on a locked key is a PIN attempt, on an unlocked one it types a slot */
if (!DARK.test(s.what)) throw new Error(`the key is not dark (locked) for its PIN: ${s.what.replace(/^.*?: /, '')} - nothing pressed`);
const r = await drive.machine('press', drive.app.shell, { buttons: pin.split('') });
if (!r.ok) throw new Error(`the PIN was not pressed: ${r.why}`);
for (let i = 0; ; i++) {
  const n = await drive.machine('key-state');
  if (n.ok && CONFIG_RED.test(n.what)) break;
  if (n.ok && GREEN.test(n.what)) throw new Error('the key unlocked GREEN after its PIN - unlocked, but not in config mode');
  if (i >= 20) throw new Error('the key stayed dark 20 s after its PIN - one wrong attempt; not tried again');
  await new Promise((ok) => setTimeout(ok, 1000));
}
drive.say('the key is unlocked in config mode (its LED pulses red)');

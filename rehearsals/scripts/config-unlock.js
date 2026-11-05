/*
 * THE PIN AGAIN, THEN "Check config mode" (config-pin-set.yaml): the key locked itself on its way into config mode (PRE -
 * the app's PIN screen with "Check config mode" beside the pad). The PIN goes in on the key's buttons from the machine
 * that holds it - the gadget's socket, or a test hard key's debug console - then the app says the key unlocked, and its
 * own check (the next step, config-expect "on") proves config mode.
 *
 * NEVER THE LED (Brad, 2026-11-04: "the led should not be a trigger for testing"): the app's flags say locked or not; the
 * check says config mode.
 *
 * PIN: the key's own - the flow's PIN, else the kit's 1111111 on a test hard key (its console answers;
 * tools/box/hardkey-setup.js), else the drive's testing PIN (the gadget).
 */
const s = await drive.machine('key-state');
if (!s.ok) throw new Error(`the key: ${s.why}`);
const hard = /debug console answers/.test(s.what);
if (!hard && !/\btestnet\b/.test(s.what)) throw new Error(`the key is not a test key (${s.what}) - the drive does not press it`);
const pin = String(typeof PIN !== 'undefined' ? PIN : hard ? '1111111' : '1234561');
/* pressed only while locked: a press on a locked key is a PIN attempt, on an unlocked one it types a slot */
if (drive.app.flags.key !== 'locked') throw new Error(`the app does not say the key is locked for its PIN ("${drive.app.flags.key}") - nothing pressed`);
const r = await drive.machine('press', drive.app.shell, { buttons: pin.split('') });
if (!r.ok) throw new Error(`the PIN was not pressed: ${r.why}`);
const until = Date.now() + 20000;
while (drive.app.flags.key === 'locked') {
  if (Date.now() > until) throw new Error('the key stayed locked 20 s after its PIN - one wrong attempt; not tried again');
  await new Promise((ok) => setTimeout(ok, 500));
}
drive.say(`the key unlocked after its PIN (the app says "${drive.app.flags.key}") - its check says config mode next`);

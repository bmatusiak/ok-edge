/*
 * THE PIN ON THE KEY'S OWN BUTTONS, AS A PERSON UNLOCKS (lockout-unlock.yaml): pressed from the machine that holds the key
 * (a test hard key's debug console, the gadget's socket), not on the app's keypad - the app learns of the unlock from the
 * key, as it does from a person's fingers. Locked first: a press on an unlocked key types a slot. PIN: the flow's, else the
 * app's one PIN, 1234561 (a hard test key is set up by the app - hardkey-setup.yaml).
 */
const pin = String(typeof PIN === 'undefined' ? '1234561' : PIN);
if (drive.app.flags.key !== 'locked') throw new Error(`the app does not say the key is locked ("${drive.app.flags.key}") - nothing pressed`);
const r = await drive.machine('press', drive.app.shell, { buttons: pin.split('') });
if (!r.ok) throw new Error(`the PIN was not pressed: ${r.why}`);
const until = Date.now() + 20000;
while (drive.app.flags.key === 'locked') {
  if (Date.now() > until) throw new Error('the key stayed locked 20 s after its PIN - one wrong attempt; not tried again');
  await new Promise((ok) => setTimeout(ok, 300));
}
drive.say(`the key unlocked on its own buttons (the app says "${drive.app.flags.key}")`);

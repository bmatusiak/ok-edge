/*
 * THE APP'S PIN ON A BLANK HARD KEY'S OWN BUTTONS, FOR ITS SETUP TAB (hardkey-setup.yaml; Brad, 2026-11-05: one PIN in the
 * app - 1234561 - and a key the testing kit used is cleared and set up by the app). The Setup tab's hard-key page asks the
 * key to take a PIN and says "press it on the OnlyKey's buttons"; a person's fingers do that, here the key's DEBUG console.
 * Done only once the key took every digit: the firmware prints "password appended with" per digit, and a step asked
 * before the last one lands saves a short PIN (the kit's own measurement, onlykey-testing initialized.js).
 */
const pin = String(typeof PIN === 'undefined' ? '1234561' : PIN);
const s = await drive.machine('key-state');
if (!s.ok || !/debug console answers/.test(s.what)) throw new Error(`not a test hard key (${s.ok ? s.what : s.why}) - nothing pressed`);
const at = Date.now();
const r = await drive.machine('press', drive.app.shell, { buttons: pin.split('') });
if (!r.ok) throw new Error(`the PIN was not pressed: ${r.why}`);
const took = await drive.machine('console-count', drive.app.shell, { re: 'password appended with', n: pin.length, sinceAge: Date.now() - at, life: 20 });
if (!took.ok) throw new Error(`the key did not take all ${pin.length} presses: ${took.why}`);
drive.say(`the key took the ${pin.length}-digit PIN on its buttons (${took.what})`);

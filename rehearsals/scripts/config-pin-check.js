/*
 * THE NEW SECOND-PROFILE PIN OPENS THE KEY (config-pin.yaml): the key restarted out of config mode (unplugged and back -
 * the only way out of it), so it is dark (locked); PIN2 on its buttons and its LED goes green - the second profile
 * unlocked. A wrong PIN2 leaves it dark: one wrong attempt, not tried again. The app is not logged in on that profile.
 */
const GREEN = /led #00[4-9a-f][0-9a-f]00\b/;
const DARK = /led #000000\b/;
const pin2 = String(typeof PIN2 === 'undefined' ? '' : PIN2);
if (!/^\d{7,10}$/.test(pin2)) throw new Error(`PIN2 must be 7 to 10 digits (got "${pin2}")`);
let s = await drive.machine('key-state');
for (let i = 0; s.ok && !DARK.test(s.what) && i < 10; i++) {
  await new Promise((ok) => setTimeout(ok, 1000));
  s = await drive.machine('key-state');
}
if (!s.ok) throw new Error(`the key: ${s.why}`);
if (!/\btestnet\b/.test(s.what)) throw new Error(`the key is not a testnet one (${s.what}) - the drive does not press it`);
if (!DARK.test(s.what)) throw new Error(`the key is not dark (locked) after its restart: ${s.what.replace(/^.*?: /, '')} - nothing pressed`);
const r = await drive.machine('press', drive.app.shell, { buttons: pin2.split('') });
if (!r.ok) throw new Error(`the second-profile PIN was not pressed: ${r.why}`);
for (let i = 0; ; i++) {
  const n = await drive.machine('key-state');
  if (n.ok && GREEN.test(n.what)) break;
  if (i >= 20) throw new Error(`the key stayed dark 20 s after the new second-profile PIN (${pin2.length} digits) - it did not take; not tried again`);
  await new Promise((ok) => setTimeout(ok, 1000));
}
drive.say(`the new second-profile PIN unlocks the key (${pin2.length} digits)`);

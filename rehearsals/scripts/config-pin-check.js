/*
 * THE NEW SECOND-PROFILE PIN OPENS THE KEY (config-pin.yaml): the key restarted out of config mode (unplugged and back -
 * the only way out of it), so it is locked; PIN2 on its buttons and the app says it unlocked - the second profile. A
 * wrong PIN2 leaves it locked: one wrong attempt, not tried again. The app is not logged in on that profile.
 *
 * NEVER THE LED (Brad, 2026-11-04: "the led should not be a trigger for testing"): the app's flags, which follow what the
 * key itself reports (its status), say locked or not.
 */
const pin2 = String(typeof PIN2 === 'undefined' ? '' : PIN2);
if (!/^\d{7,10}$/.test(pin2)) throw new Error(`PIN2 must be 7 to 10 digits (got "${pin2}")`);
const s = await drive.machine('key-state');
if (!s.ok) throw new Error(`the key: ${s.why}`);
if (!/\btestnet\b|debug console answers/.test(s.what)) throw new Error(`the key is not a test key (${s.what}) - the drive does not press it`);
/* locked after its restart - the app says so once the key is back (its reconnect is the event; 20 s the watchdog) */
await drive.waitForLog(/\[(hardkey|softkey)\] state: locked/, 20).catch(() => null);
if (drive.app.flags.key !== 'locked') throw new Error(`the app does not say the key is locked after its restart ("${drive.app.flags.key}") - nothing pressed`);
const r = await drive.machine('press', drive.app.shell, { buttons: pin2.split('') });
if (!r.ok) throw new Error(`the second-profile PIN was not pressed: ${r.why}`);
const until = Date.now() + 20000;
while (drive.app.flags.key === 'locked') {
  if (Date.now() > until) throw new Error(`the key stayed locked 20 s after the new second-profile PIN (${pin2.length} digits) - it did not take; not tried again`);
  await new Promise((ok) => setTimeout(ok, 500));
}
drive.say(`the new second-profile PIN unlocks the key (${pin2.length} digits)`);

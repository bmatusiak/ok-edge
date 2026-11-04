/*
 * THE KEY LOCKED ON ITS OWN BUTTON (sheet-forget.yaml): button 3 held - the gadget's 'hold' press mode. The firmware's
 * button 3 hold runs what its idle lockout runs (OnlyKey.ino: unlocked = false, the profile key wiped, CPU_RESTART), so
 * this is the inactivity lock without the wait. The proof is MainApp's line "[login] the Log in page from ...: a clean
 * app" - listened for BEFORE the hold: it comes as the key restarts, before the press itself returns.
 *
 * THE KEY IGNORES A HOLD for up to 20 s after a security-key request (config-hold.js), so the hold waits for the app to
 * ask the key nothing for QUIET_S first.
 */
const QUIET_S = 22;
/* a tab opening reads the key ~40 times in a burst: the wait is bounded by time, not by how many reads */
const GIVE_UP = Date.now() + 120000;
for (;;) {
  const asked = await drive.waitForLog(/\[timeline\] \d+ begin #\d+ /, QUIET_S).then((l) => l, () => null);
  if (!asked) break;
  if (Date.now() > GIVE_UP) throw new Error(`the app kept asking the key - no ${QUIET_S} s of quiet in 2 min for the hold: ${String(asked).replace(/^.*\[timeline\] \d+ /, '')}`);
}
const clean = drive.waitForLog(/\[login\] the Log in page from \w+: a clean app/, 30).then((l) => l, () => null);
/* the press's own answer may fail: the key restarts under it, and the gadget does not say its state in time */
const r = await drive.machine('press', drive.app.shell, { buttons: ['3:hold'] });
drive.say(r.ok ? r.what : `button 3 held (the press said: ${r.why})`);
if (!(await clean)) throw new Error('button 3 held, but the app never came to a clean Log in page');
drive.say('the key locked; the app is on a clean Log in page');

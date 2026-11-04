/*
 * THE KEY LOCKED ON ITS OWN BUTTON (sheet-forget.yaml): button 3 held - the gadget's 'hold' press mode. The firmware's
 * button 3 hold runs what its idle lockout runs (OnlyKey.ino: unlocked = false, the profile key wiped, CPU_RESTART), so
 * this is the inactivity lock without the wait. A lock out of config mode logs the person out: the app's Log in page,
 * everything of the key forgotten - the proof is idle-wait.js's line, "[login] the Log in page from ...: a clean app".
 *
 * THE KEY IGNORES A HOLD for up to 20 s after a security-key request (config-hold.js), so the hold waits for the app to
 * ask the key nothing for QUIET_S first.
 */
const QUIET_S = 22;
for (let n = 0; ; n++) {
  const asked = await drive.waitForLog(/\[timeline\] \d+ begin #\d+ /, QUIET_S).then((l) => l, () => null);
  if (!asked) break;
  if (n >= 10) throw new Error(`the app kept asking the key - no ${QUIET_S} s of quiet for the hold: ${String(asked).replace(/^.*\[timeline\] \d+ /, '')}`);
}
const r = await drive.machine('press', drive.app.shell, { buttons: ['3:hold'] });
if (!r.ok) throw new Error(`button 3 was not held: ${r.why}`);
drive.say(r.what);

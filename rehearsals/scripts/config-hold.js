/*
 * INTO CONFIG MODE ON THE KEY'S OWN BUTTON (config-pin-set.yaml): button 6 held - the gadget's 'hold' press mode, the
 * firmware's gesture - and the key locks itself on the way in. The app was told first ("I will hold button 6", WANTED),
 * so that lock is config mode's and NOT a lock that forgets the key (Brad, 2026-11-03: "unplugged state or a sudden lock
 * fire the forget event - unless config mode"): the proof is MainApp's line "... in config mode (...): nothing forgotten".
 *
 * THE KEY IGNORES A HOLD for up to 20 s after a security-key request (src/ui/ConfigModePanel.tsx, the firmware's rule),
 * so the hold waits for the app to ask the key nothing for QUIET_S first - the key's own quiet, not a guess at a delay.
 */
const QUIET_S = 22;
for (let n = 0; ; n++) {
  const asked = await drive.waitForLog(/\[timeline\] \d+ begin #\d+ /, QUIET_S).then((l) => l, () => null);
  if (!asked) break;
  if (n >= 10) throw new Error(`the app kept asking the key - no ${QUIET_S} s of quiet for the hold: ${String(asked).replace(/^.*\[timeline\] \d+ /, '')}`);
}
/* listened for BEFORE the hold (box, 2026-11-03: the line came in the same tick as the lock and a wait begun after it missed it) */
const keptLine = drive.waitForLog(/\[key\] the key left unlocked \(\w+\) in config mode \([^)]+\): nothing forgotten/, 30).then((l) => l, () => null);
const r = await drive.machine('press', drive.app.shell, { buttons: ['6:hold'] });
if (!r.ok) throw new Error(`button 6 was not held: ${r.why}`);
drive.say(r.what);
const until = Date.now() + 15000;
while (drive.app.flags.key !== 'locked') {
  if (Date.now() > until) throw new Error(`button 6 held, but the key did not lock in 15 s (the app says "${drive.app.flags.key}")`);
  await new Promise((ok) => setTimeout(ok, 500));
}
const kept = await keptLine;
if (!kept) throw new Error('the key locked for config mode, but the app did not say it kept the key (no "in config mode (...): nothing forgotten") - a config-mode lock must not forget');
drive.say('the key locked for config mode; the app kept the key (nothing forgotten)');

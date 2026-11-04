/*
 * NOTHING DONE UNTIL THE KEY LOCKS ITSELF (idle-relogin.yaml): the key's idle lockout restarts it, locked - and the app
 * must clear itself as for an unplug (Brad, 2026-11-03: "why are we not clearing the state when it locks like unplugs"):
 * its "[key] the <key> locked: its session goes" line (src/hooks/useKey.ts) is the proof, and its key state "locked"
 * after it. A quiet wait up to the lock-after and a margin; an app that never clears is the bug red-key showed.
 */
const MINUTES_N = Math.max(1, parseInt(typeof MINUTES === 'undefined' ? '1' : MINUTES, 10) || 1);
const cleared = await drive.waitForLog(/\[key\] the .* locked: its session goes/, MINUTES_N * 60 + 90)
  .then((l) => l, (e) => { throw new Error(`the key locked, but the app never cleared its session as for an unplug: ${String(e.message).split('\n')[0]}`); });
const until = Date.now() + 15000;
while (drive.app.flags.key !== 'locked') {
  if (Date.now() > until) throw new Error(`the app cleared its session but says the key is "${drive.app.flags.key}", not locked`);
  await new Promise((r) => setTimeout(r, 1000));
}
drive.say(`the key locked itself; the app cleared as for an unplug (${String(cleared).replace(/^.*\[key\] /, '')}) and says locked`);

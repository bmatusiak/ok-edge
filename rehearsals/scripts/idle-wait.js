/*
 * NOTHING DONE UNTIL THE KEY LOCKS ITSELF (idle-relogin.yaml): the key's idle lockout restarts it, locked - the app must
 * see that: its key state goes to "locked" (the login screen). Read from the app's own flags, a look every 2 s, up to
 * the lock-after and a margin; an app that never says "locked" is the bug red-key showed (it carried "unlocked" on).
 */
const MINUTES_N = Math.max(1, parseInt(typeof MINUTES === 'undefined' ? '1' : MINUTES, 10) || 1);
const until = Date.now() + (MINUTES_N * 60 + 90) * 1000;
while (drive.app.flags.key !== 'locked') {
  if (Date.now() > until) throw new Error(`the app never saw the key lock itself: its key state is still "${drive.app.flags.key}"`);
  await new Promise((r) => setTimeout(r, 2000));
}
drive.say('the key locked itself, and the app says so (locked)');

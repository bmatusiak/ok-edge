/*
 * NOTHING DONE UNTIL THE KEY LOCKS ITSELF (idle-relogin.yaml): the key's idle lockout restarts it, locked - and the app
 * must be a clean app on the Log in page (Brad, 2026-11-03: "if i see the log in page, it should be a clear app";
 * "why are we not clearing the state when it locks like unplugs"). Every road there ends in MainApp's clean-up line,
 * "[login] the Log in page from <phase>: a clean app" - the proof - and the key state "locked" after it.
 */
const MINUTES_N = Math.max(1, parseInt(typeof MINUTES === 'undefined' ? '1' : MINUTES, 10) || 1);
const cleared = await drive.waitForLog(/\[login\] the Log in page from \w+: a clean app/, MINUTES_N * 60 + 90)
  .then((l) => l, (e) => { throw new Error(`the key locked, but the app never came to a clean Log in page: ${String(e.message).split('\n')[0]}`); });
const until = Date.now() + 15000;
while (drive.app.flags.key !== 'locked') {
  if (Date.now() > until) throw new Error(`the app is on a clean Log in page but says the key is "${drive.app.flags.key}", not locked`);
  await new Promise((r) => setTimeout(r, 1000));
}
drive.say(`the key locked itself; the app is a clean app on the Log in page (${String(cleared).replace(/^.*\[login\] /, '').slice(0, 60)}) and says locked`);

/*
 * A REHEARSAL THAT WIPES AND PRESSES RUNS ON A TEST KEY ONLY: the app's machine says its key is a testnet one, or a hard
 * key whose debug console answers (a test hex). A production key - a live key - has no console: the flow stops here.
 */
const s = await drive.machine('key-state');
if (!s.ok || !/debug console answers|testnet/.test(String(s.what))) {
  throw new Error(`not a test key (${s.ok ? s.what : s.why}) - this rehearsal wipes and presses, so it runs on a test key only`);
}
drive.say(`test key: ${s.what}`);

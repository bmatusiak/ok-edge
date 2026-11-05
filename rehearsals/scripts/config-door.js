/*
 * WHERE CONFIG MODE'S PIN GOES IN (box desktop, 2026-11-04: blue-key in a test build). The key locked on its way in, and
 * the app chose its door at that lock (MainApp.tsx): the Log in page with its red "Enter config mode", or - testing mode
 * on, as a test build turns it on with a hard key - the main screen, where This Key has the PIN pad and "Check config
 * mode". The app's own phase says which; config-in.yaml takes that door.
 */
const phase = drive.app.flags.phase;
if (phase !== 'login' && phase !== 'main') throw new Error(`config mode's door: the app is at "${phase}", neither the Log in page nor the main screen`);
output.configDoor = phase;
drive.say(`config mode's PIN: ${phase === 'login' ? 'the Log in page (Enter config mode)' : 'This Key (testing mode)'}`);

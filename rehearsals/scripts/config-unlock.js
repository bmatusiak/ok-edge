/*
 * THE PIN AGAIN, THEN "Check config mode" (config-pin-set.yaml): the key locked itself on its way into config mode (PRE -
 * the app's PIN screen with "Check config mode" beside the pad). The PIN goes in on the key's buttons from the machine
 * that holds it - the gadget's socket, or a test hard key's debug console - then the app says the key unlocked, and its
 * own check (the next steps: "Check config mode", config-expect "on") proves config mode.
 *
 * NEVER THE LED (Brad, 2026-11-04: "the led should not be a trigger for testing"). Nor the app's flags after the PIN: in
 * config mode the key holds back its UNLOCKED broadcast (MainApp.tsx checkConfig), so the app learns it only from its
 * check. That the PIN went in: the gadget's press returns once it took every digit; a hard key's DEBUG console says
 * "UNLOCKED" (box, 2026-11-04, blue-key: "GUESSED PROFILE 1 PIN ... UNLOCKED").
 *
 * PIN: the flow's, else the app's one PIN, 1234561 - a hard test key included (cleared after the testing kit and set up
 * by the app, hardkey-setup.yaml; Brad, 2026-11-05: one PIN in the app).
 */
const s = await drive.machine('key-state');
if (!s.ok) throw new Error(`the key: ${s.why}`);
const hard = /debug console answers/.test(s.what);
if (!hard && !/\btestnet\b/.test(s.what)) throw new Error(`the key is not a test key (${s.what}) - the drive does not press it`);
const pin = String(typeof PIN !== 'undefined' ? PIN : '1234561');
/* pressed only while locked: a press on a locked key is a PIN attempt, on an unlocked one it types a slot */
if (drive.app.flags.key !== 'locked') throw new Error(`the app does not say the key is locked for its PIN ("${drive.app.flags.key}") - nothing pressed`);
const pressedAt = Date.now();
const r = await drive.machine('press', drive.app.shell, { buttons: pin.split('') });
if (!r.ok) throw new Error(`the PIN was not pressed: ${r.why}`);
if (hard) {
  const said = await drive.machine('console-said', drive.app.shell, { re: 'UNLOCKED', sinceAge: Date.now() - pressedAt, life: 20 });
  if (!said.ok) throw new Error(`the key did not take its PIN (${said.why}) - one wrong attempt; not tried again`);
  drive.say(`the key took its PIN (its console: "${said.what}") - its check says config mode next`);
} else drive.say(`the PIN went in (${r.what}) - its check says config mode next`);

/*
 * THE NEW SECOND-PROFILE PIN ON THE KEY'S BUTTONS (config-pin-set.yaml): the app's hard-key PIN page asks the person to
 * press it (src/screens/HardKeySetupScreen.tsx - the app never sees the digits; the key compares its two passes itself).
 * Pressed when the page says to - its own words for this pass (PASS: first, or again) - then PIN2 on the gadget.
 */
const pin2 = String(typeof PIN2 === 'undefined' ? '' : PIN2);
if (!/^\d{7,10}$/.test(pin2)) throw new Error(`PIN2 must be 7 to 10 digits (got "${pin2}")`);
const again = typeof PASS !== 'undefined' && String(PASS) === 'again';
const asks = again ? /Press the same second-profile PIN/ : /Press your new second-profile PIN/;
const until = Date.now() + 30000;
while (!asks.test(String(drive.app.text || ''))) {
  if (Date.now() > until) throw new Error(`the PIN page never asked for the second-profile PIN to be pressed${again ? ' again' : ''} (30 s)`);
  await new Promise((ok) => setTimeout(ok, 500));
}
const r = await drive.machine('press', drive.app.shell, { buttons: pin2.split('') });
if (!r.ok) throw new Error(`the second-profile PIN was not pressed: ${r.why}`);
drive.say(`the second-profile PIN pressed on the key${again ? ' again' : ''} (${pin2.length} digits)`);

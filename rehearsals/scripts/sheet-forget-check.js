/*
 * NOTHING OF THE KEY ON SCREEN AFTER THE LOGOUT (sheet-forget.yaml): the key locked with a sheet open, and the app is on
 * its Log in page (lock-hold.js). No sheet may be over it: the drive's open layers (src/drive/registry.tsx layerStack,
 * "218:sheet") are none.
 */
const until = Date.now() + 5000;
let layers = drive.app.layers || [];
while (layers.length && Date.now() < until) {
  await new Promise((r) => setTimeout(r, 500));
  layers = drive.app.layers || [];
}
if (layers.length) throw new Error(`logged out, and a sheet stayed over the Log in page: ${layers.join(' > ')}`);
drive.say('no sheet over the Log in page');

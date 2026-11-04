/*
 * NOTHING OF THE KEY ON SCREEN AFTER THE LOGOUT (sheet-forget.yaml): the key locked with a sheet open, and the app is on
 * its Log in page (idle-wait.js). No sheet may be over it - the drive's open layers (src/drive/registry.tsx layerStack,
 * "218:sheet") are none - and the app said the forget ("[identity] the key went").
 */
const until = Date.now() + 5000;
let layers = drive.app.layers || [];
while (Date.now() < until) {
  layers = drive.app.layers || [];
  if (!layers.length) break;
  await new Promise((r) => setTimeout(r, 500));
}
if (layers.length) throw new Error(`logged out, and a sheet stayed over the Log in page: ${layers.join(' > ')}`);
const said = drive.app.recent.filter((l) => /\[identity\] the key went/.test(l)).pop();
if (!said) throw new Error('logged out with no sheet left, but the app never said the key was forgotten ("[identity] the key went")');
drive.say(`no sheet over the Log in page; ${said.replace(/^.*\[identity\] /, '')}`);

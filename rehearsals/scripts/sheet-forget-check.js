/*
 * NOTHING OF THE KEY ON SCREEN AFTER THE FORGET (sheet-forget.yaml): the key locked with a budget ask on the sheet, and
 * the app is on its Log in page (idle-wait.js). No sheet may be over it - the drive's top layer is the page itself - and
 * the ask the sheet held is refused, not left waiting for a person who logged out with the key.
 */
const ASK = 'An agent asks for a budget';
const until = Date.now() + 5000;
let layers = drive.app.layers || [];
while (Date.now() < until) {
  layers = drive.app.layers || [];
  if (!layers.length) break;
  await new Promise((r) => setTimeout(r, 500));
}
/* the open layers by name (src/drive/registry.tsx layerStack: "218:sheet"): an open sheet is one */
if (layers.length) throw new Error(`the key was forgotten, and a sheet stayed over the Log in page: ${layers.join(' > ')}`);
if (String(drive.app.text || '').includes(ASK)) throw new Error(`the key was forgotten, and "${ASK}" is still on screen`);
const r = output.__ship ? await output.__ship : { ok: false, why: 'no ship was started (ship-start.js)' };
output.__ship = null;
if (r.ok && !/budget was refused|STOP/.test(r.what || '')) throw new Error(`the ask on the forgotten key's sheet went through: ${String(r.what).split('\n').slice(-3).join(' / ')}`);
drive.say(`no sheet over the Log in page; the ask refused (${String(r.why || r.what || '').split('\n').filter(Boolean).slice(-1)[0] || 'refused'})`);

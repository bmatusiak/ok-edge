'use strict';
/*
 * THE KEYS THE DRIVE CAN SEE (Brad, 2026-10-31: "a key status monitor ... to detect keys on the host/gadget/usb
 * devices"): every OnlyKey on the USB of the app's machine - hard keys and the gadget soft key, with their hidraw
 * nodes - and the app's own key as its flags say it (the desktop's and the phone's soft key).   run.js keys [--app <shell>]
 */
module.exports = async (d) => {
  const r = await d.machine('keys');
  if (!r.ok) throw new Error(`keys (${r.where}): ${r.why}`);
  const keys = JSON.parse(r.what);
  if (keys === null) d.say(`${r.where}: its USB keys are not watched on that OS yet`);
  else if (!keys.length) d.say(`${r.where}: no OnlyKey on its USB`);
  else for (const k of keys) d.say(`${r.where}: ${k.kind} key - usb ${k.usb}${k.serial ? `, serial ${k.serial}` : ''}${k.hidraw.length ? `, ${k.hidraw.join(' ')}` : ''}`);
  if (!d.app.closed && d.app.ws) d.say(`the ${d.app.shell} app's own key: ${(d.app.flags && d.app.flags.key) || 'not said'} (net ${d.app.net})`);
};

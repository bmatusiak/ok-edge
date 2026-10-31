'use strict';
/*
 * AN APP'S KEY, ASKED OF THE MACHINE THAT HOLDS IT (the web app's: its key is outside the browser):
 *   run.js key [--app webapp]                  its state (the gadget's LED now)
 *   run.js key [--app webapp] press 1 2 3 ...  press its buttons - TESTNET keys only, as every drive press
 */
module.exports = async (d, args) => {
  if (args[0] === 'press') {
    if (d.app.net !== 'test' && !(d.app.closed || !d.app.ws)) throw new Error(`the ${d.app.shell} app is on the ${d.app.net} chain - the drive presses testnet keys only`);
    const r = await d.machine('press', d.app.shell, { buttons: args.slice(1) });
    if (!r.ok) throw new Error(`press (${r.where}): ${r.why}`);
    d.say(`${r.what} (${r.where})`);
  }
  const s = await d.machine('key-state');
  d.say(s.ok ? `its key (${s.where}): ${s.what}` : `its key: ${s.why}`);
};

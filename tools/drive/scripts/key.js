'use strict';
/*
 * AN APP'S KEY, ASKED OF THE MACHINE THAT HOLDS IT (the web app's: its key is outside the browser):
 *   run.js key [--app webapp]                  its state (the gadget's LED now)
 *   run.js key [--app webapp] press 1 2 3 ...  press its buttons - TESTNET keys only
 * Which chain a key is on is the key's, not the page's: a web app says "live" until it has talked to its key, while its
 * machine knows the gadget is a throwaway testnet soft key. So a press goes when the app is on the testnet, or its
 * machine names the key a testnet one.
 */
module.exports = async (d, args) => {
  const s = await d.machine('key-state');
  if (args[0] === 'press') {
    const testKey = s.ok && /\btestnet\b/.test(String(s.what));
    if (d.app.net !== 'test' && !testKey) throw new Error(`the ${d.app.shell} app is on the ${d.app.net} chain and its machine does not name its key a testnet one - the drive presses testnet keys only`);
    const r = await d.machine('press', d.app.shell, { buttons: args.slice(1) });
    if (!r.ok) throw new Error(`press (${r.where}): ${r.why}`);
    d.say(`${r.what} (${r.where})`);
    const after = await d.machine('key-state');
    d.say(after.ok ? `its key now (${after.where}): ${after.what}` : `its key: ${after.why}`);
    return;
  }
  d.say(s.ok ? `its key (${s.where}): ${s.what}` : `its key: ${s.why}`);
};

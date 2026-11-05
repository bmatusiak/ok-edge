/*
 * THE DEBUG KEYSTORE'S KEY INTO AN RSA SLOT OF A TEST KEY (gadget-rsa-key.yaml, the signing dry run): the CLI's setkey
 * on the app's own machine, through this app's key session (the key is in config mode - outside it the key drops a key
 * write without a word). KEYHEX: the key's p||q, hex - the repo debug keystore's, public; never a real signing key.
 * Not given, it is read from signing/debug.keystore on the key's machine (tools/box/debug-key-hex.js; Brad, 2026-11-05:
 * "never assume blue key between runs" - the flow puts on the key what it needs, from nothing).
 */
const slot = String(typeof SLOT === 'undefined' ? 'RSA2' : SLOT);
let hex = String(typeof KEYHEX === 'undefined' ? '' : KEYHEX);
if (!hex) {
  const t = await drive.machine('tool', 'firmware', { name: 'debug-key-hex.js' });
  if (!t.ok) throw new Error(`the debug key: ${t.why}`);
  hex = (String(t.what).match(/[0-9a-f]{512}/i) || [''])[0];
}
if (!/^[0-9a-f]{512}$/i.test(hex)) throw new Error('KEYHEX: an RSA-2048 key\'s p||q, 512 hex characters (the debug keystore\'s)');
const r = await drive.machine('cli', drive.app.shell, { argv: ['setkey', slot, '2', 's', hex] });
if (!r.ok) throw new Error(`setkey ${slot}: ${r.why}`);
drive.say(`setkey ${slot}: ${String(r.what).split('\n').filter((l) => !/shell history/.test(l)).slice(-2).join(' | ')}`);

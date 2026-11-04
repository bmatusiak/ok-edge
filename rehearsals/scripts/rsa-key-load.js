/*
 * THE DEBUG KEYSTORE'S KEY INTO AN RSA SLOT OF A TEST KEY (gadget-rsa-key.yaml, the signing dry run): the CLI's setkey
 * on the app's own machine, through this app's key session (the key is in config mode - outside it the key drops a key
 * write without a word). KEYHEX: the key's p||q, hex - the repo debug keystore's, public; never a real signing key.
 */
const slot = String(typeof SLOT === 'undefined' ? 'RSA2' : SLOT);
const hex = String(typeof KEYHEX === 'undefined' ? '' : KEYHEX);
if (!/^[0-9a-f]{512}$/i.test(hex)) throw new Error('KEYHEX: an RSA-2048 key\'s p||q, 512 hex characters (the debug keystore\'s)');
const r = await drive.machine('cli', drive.app.shell, { argv: ['setkey', slot, '2', 's', hex] });
if (!r.ok) throw new Error(`setkey ${slot}: ${r.why}`);
drive.say(`setkey ${slot}: ${String(r.what).split('\n').filter((l) => !/shell history/.test(l)).slice(-2).join(' | ')}`);

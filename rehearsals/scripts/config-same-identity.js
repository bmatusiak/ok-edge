/*
 * THE SAME KEY AFTER A CONFIG-MODE WRITE (config-restore.yaml, config-pin.yaml): the identity the login read before
 * config mode and the one it read after, from the app's own "[identity] <id>: ..." lines (waitForLog as: identityBefore
 * / identityAfter). WHAT: the write, for the words. A key restoring its own backup comes back as itself; so does a key
 * given a second-profile PIN (patch 0018: before it, the primary profile came back as another key, its FIDO2 blocked).
 */
const what = typeof WHAT === 'undefined' ? 'the restore' : String(WHAT);
const id = (l) => (String(l || '').match(/\[identity\] ([0-9a-f]{12}):/) || [])[1] || null;
const before = id(output.identityBefore);
const after = id(output.identityAfter);
if (!before || !after) throw new Error(`the identity was not read ${!before ? 'before' : 'after'} ${what}`);
if (before !== after) throw new Error(`the key came back as ${after}, not ${before}, after ${what}`);
drive.say(`the key came back as itself after ${what} (${after})`);

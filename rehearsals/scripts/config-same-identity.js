/*
 * THE SAME KEY AFTER THE RESTORE (config-restore.yaml): the identity the login read before config mode and the one it read
 * after the restore, from the app's own "[identity] <id>: ..." lines (waitForLog as: identityBefore / identityAfter). A
 * key restoring its own backup comes back as itself; another key's backup makes it that key - said, and failed.
 */
const id = (l) => (String(l || '').match(/\[identity\] ([0-9a-f]{12}):/) || [])[1] || null;
const before = id(output.identityBefore);
const after = id(output.identityAfter);
if (!before || !after) throw new Error(`the identity was not read ${!before ? 'before' : 'after'} the restore`);
if (before !== after) throw new Error(`the key came back as ${after}, not ${before} - the backup restored was another key's`);
drive.say(`the key came back as itself after the restore (${after})`);

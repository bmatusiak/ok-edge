'use strict';
/*
 * the soft key as a new device made from a backup, then one budget on it:
 *   run.js restore <backup file> <passphrase json> [json key=passphrase]
 * Two runs from one backup are two forks of one point: the Edge tab's flag.
 */
const { restore, budget } = require('../flows');
module.exports = async (d, [backup, passphraseFile, passphraseKey]) => {
  if (!backup || !passphraseFile) throw new Error('restore <backup file> <passphrase json> [json key]');
  d = await d.up();
  d = await restore(d, { backup, passphraseFile, passphraseKey: passphraseKey || 'passphrase' });
  await budget(d);
};

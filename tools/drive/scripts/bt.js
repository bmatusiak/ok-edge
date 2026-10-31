'use strict';
/*
 * CAPTURE BLUETOOTH NOW (drive debugging #8): the machine that holds the phone runs ok-rn's btcapture.js - read-only,
 * every part saved as it is read - the moment a link breaks, before anything cures it. Its folder and summary come
 * back here.   run.js bt [--app android]
 */
module.exports = async (d) => {
  const r = await d.machine('bt-capture');
  if (!r.ok) throw new Error(`bt capture (${r.where}): ${r.why}`);
  d.say(`captured on ${r.where}:`);
  for (const l of String(r.what).split('\n')) d.say(`  ${l}`);
};

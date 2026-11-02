'use strict';
/*
 * logged in to the soft key, from wherever the app is:  run.js login [pin | --pin <pin>] [--by-hand]
 * --by-hand: the drive leaves the Edge press to the person (tools/box/press-window.js) - the browser's touches it still gives
 */
const { login } = require('../flows');
module.exports = async (d, args) => {
  const p = args.indexOf('--pin');
  const pin = p >= 0 ? args[p + 1] : args[0] && !args[0].startsWith('--') ? args[0] : undefined;
  const hold = args.includes('--by-hand');
  if (hold) d.holdPress(true);
  try { return await login(await d.up(), pin ? { pin } : {}); } finally { if (hold) d.holdPress(false); }
};

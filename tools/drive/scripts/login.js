'use strict';
/* logged in to the soft key, from wherever the app is:  run.js login [pin | --pin <pin>] */
const { login } = require('../flows');
module.exports = async (d, args) => {
  const p = args.indexOf('--pin');
  const pin = p >= 0 ? args[p + 1] : args[0];
  return login(await d.up(), pin ? { pin } : {});
};

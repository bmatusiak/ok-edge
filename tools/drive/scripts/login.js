'use strict';
/* logged in to the soft key, from wherever the app is:  run.js login [pin] */
const { login } = require('../flows');
module.exports = async (d, [pin]) => login(d, pin ? { pin } : {});

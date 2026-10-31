'use strict';
/* one budget on the soft key - approved, three signs it pays - from wherever it stands:  run.js budget [times] */
const { login, budget } = require('../flows');
module.exports = async (d, [times = '1']) => {
  await login(d);
  for (let n = 1; n <= Number(times); n++) { d.say(`budget ${n} of ${times}`); await budget(d); }
};

'use strict';
/* one budget on the soft key - approved, three signs it pays - from wherever it stands:  run.js budget [times] [--pin <pin>] */
const { login, budget } = require('../flows');
module.exports = async (d, args) => {
  const p = args.indexOf('--pin');
  const pin = p >= 0 ? args[p + 1] : null;
  const [times = '1'] = args.filter((a, k) => p < 0 || (k !== p && k !== p + 1));
  d = await d.up();
  d = await login(d, pin ? { pin } : {});
  for (let n = 1; n <= Number(times); n++) { d.say(`budget ${n} of ${times}`); await budget(d); }
};

'use strict';
/* the app's picture of itself, now:  run.js shot [name] */
module.exports = async (d, [name = 'now']) => { if (!(await d.shot(name))) throw new Error('no picture'); };

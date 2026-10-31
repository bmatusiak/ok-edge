'use strict';
/* the target's process, on the machine it runs on (a drive-remote, or this one):  run.js stop [--app desktop|webapp|android] */
module.exports = async (d) => { await d.stop(); };

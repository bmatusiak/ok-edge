'use strict';
/*
 * A PRESS BY HAND, ON THE BOX (Brad, 2026-11-01: "i just need something really simple, just so i can send a key press
 * and something you can open for me, and i can close"; "this small dialog opens, i put it off to the side, 2 buttons on
 * it, send and close"): opens tools/box/press-window/ - one small window, on top, that stays where it is put. Send press
 * is one press (button 1) on the app's key through the drive-remote here; Close closes the window only - the key, the
 * app and the drive go on, and it can be opened again whenever wanted.
 *
 *   node tools/box/press-window.js [--app webapp]
 *
 * The drive's own NW.js (tools/drive/node_modules/nw), on the box screen (DISPLAY, else :10).
 */
const { spawn } = require('child_process');
const path = require('path');

const i = process.argv.indexOf('--app');
const app = i >= 0 ? process.argv[i + 1] : 'webapp';
(async () => {
const nw = await require(path.join(__dirname, '../drive/node_modules/nw')).findpath();
const child = spawn(nw, [path.join(__dirname, 'press-window'), `--app=${app}`], {
  detached: true,
  stdio: 'ignore',
  env: { ...process.env, DISPLAY: process.env.DISPLAY || ':10' },
});
child.unref();
console.log(`press window open for ${app} (pid ${child.pid}) - Send press presses its key, Close closes only the window`);
})();

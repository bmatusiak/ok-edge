'use strict';
/*
 * Starts the drive app (NW.js, gui/) - the drive server or drive-remote in its one window on this host:
 *
 *   node tools/drive/launch.js server [--remote ws://host:8791 ...] [--port 8790]
 *   node tools/drive/launch.js remote [--port 8790] [--control-port 8791]
 *
 * The same on Windows and Linux. NW.js keeps one instance per host: launched again, it only brings the window
 * forward. On Linux the window goes to the box screen (DRIVE_DISPLAY, else DISPLAY, else :10). Needs `npm install`
 * once in tools/drive (its own nw and ws). Returns at once; the drive runs until its window is closed.
 */
const { spawn } = require('child_process');

const args = process.argv.slice(2);
if (!['server', 'remote'].includes(args[0])) {
  console.error('usage: node tools/drive/launch.js server|remote [options]');
  process.exit(2);
}
(async () => {
  let nwBin;
  /* nw's findpath() is a promise (nw 0.118) */
  try { nwBin = await require('nw').findpath(); } catch (e) {
    console.error(`no NW.js here (${e.message}) - run npm install in ${__dirname}`);
    process.exit(1);
  }
  /* the Node running this, for the Node programs the drive starts (targets.js NODE): NW.js's own binary is not one */
  const env = { ...process.env, DRIVE_NODE: process.execPath };
  if (process.platform === 'linux') env.DISPLAY = process.env.DRIVE_DISPLAY || process.env.DISPLAY || ':10';
  const child = spawn(nwBin, [__dirname, ...args], { detached: true, stdio: 'ignore', env, windowsHide: false });
  child.unref();
  console.log(`drive ${args[0]}: NW.js started (pid ${child.pid}) - its window shows every line; close it to stop`);
})();

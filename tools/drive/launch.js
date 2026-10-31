'use strict';
/*
 * Starts, stops and restarts the drive app (NW.js, gui/) - the drive server or drive-remote in its one window on this
 * host:
 *
 *   node tools/drive/launch.js server [--remote ws://host:8791 ...] [--port 8790]
 *   node tools/drive/launch.js remote [--port 8790] [--control-port 8791]
 *   node tools/drive/launch.js stop
 *   node tools/drive/launch.js restart server|remote [options]
 *
 * The same on Windows and Linux. NW.js keeps one instance per host: a start while one runs is refused here (NW.js
 * would only bring the old window forward, and the old code would keep running - 2026-10-31). Its pid is kept in
 * ~/.onlykey-drive.pid, so stop and restart need no pattern and no hand-found pid. On Linux the window goes to the box
 * screen (DRIVE_DISPLAY, else DISPLAY, else :10). Needs `npm install` once in tools/drive (its own nw and ws).
 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const PIDFILE = path.join(os.homedir(), '.onlykey-drive.pid');
const args = process.argv.slice(2);

const running = () => {
  try {
    const { pid, mode } = JSON.parse(fs.readFileSync(PIDFILE, 'utf8'));
    process.kill(pid, 0);
    return { pid, mode };
  } catch { return null; }
};

/* the window closed: its process gone - not our child, so its end is checked (every 250 ms) under a 20 s watchdog */
function stop() {
  const r = running();
  if (!r) { try { fs.unlinkSync(PIDFILE); } catch { /* none */ } return Promise.resolve('not running'); }
  try { process.kill(r.pid); } catch { /* gone */ }
  return new Promise((resolve) => {
    const until = Date.now() + 20000;
    const check = () => {
      try { process.kill(r.pid, 0); } catch { try { fs.unlinkSync(PIDFILE); } catch { /* gone */ } resolve(`drive ${r.mode} stopped (pid ${r.pid})`); return; }
      if (Date.now() > until) { resolve(`drive ${r.mode} (pid ${r.pid}) did not stop in 20 s`); return; }
      setTimeout(check, 250);
    };
    check();
  });
}

async function start(mode, rest) {
  const r = running();
  if (r) { console.error(`the drive ${r.mode} already runs here (pid ${r.pid}) - node tools/drive/launch.js restart ${mode} ...`); process.exit(1); }
  let nwBin;
  /* nw's findpath() is a promise (nw 0.118) */
  try { nwBin = await require('nw').findpath(); } catch (e) {
    console.error(`no NW.js here (${e.message}) - run npm install in ${__dirname}`);
    process.exit(1);
  }
  /* the Node running this, for the Node programs the drive starts (targets.js NODE): NW.js's own binary is not one */
  const env = { ...process.env, DRIVE_NODE: process.execPath };
  if (process.platform === 'linux') env.DISPLAY = process.env.DRIVE_DISPLAY || process.env.DISPLAY || ':10';
  const child = spawn(nwBin, [__dirname, mode, ...rest], { detached: true, stdio: 'ignore', env, windowsHide: false });
  child.unref();
  fs.writeFileSync(PIDFILE, JSON.stringify({ pid: child.pid, mode }));
  console.log(`drive ${mode}: NW.js started (pid ${child.pid}) - its window shows every line; close it to stop`);
  /*
   * AND READY BEFORE THIS RETURNS (2026-10-31: a hand-made wait after a restart looked for its line in the log's last
   * three lines, missed it and waited for good): the server answers /status, with its remotes connected; a remote
   * listens on its control port. Asked every 500 ms - another process, not our event - under a 30 s watchdog.
   */
  const want = rest.includes('--remote');
  const port = mode === 'server' ? 8790 : 8791;
  const until = Date.now() + 30000;
  for (;;) {
    const ready = await new Promise((resolve) => {
      const req = http.get({ host: '127.0.0.1', port, path: mode === 'server' ? '/status' : '/', timeout: 2000 }, (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => {
          if (mode !== 'server') return resolve('listening');
          try { const s = JSON.parse(body); resolve(!want || s.remotes.some((r) => r.up) ? `up${want ? ` - remote ${s.remotes.filter((r) => r.up).map((r) => r.machine).join(', ')} connected` : ''}` : null); } catch { resolve(null); }
        });
      });
      req.on('error', () => resolve(mode !== 'server' ? null : null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
    });
    if (ready) { console.log(`drive ${mode}: ready (${ready})`); return; }
    if (Date.now() > until) { console.error(`drive ${mode}: not ready in 30 s - look at its window`); process.exitCode = 1; return; }
    await new Promise((r) => setTimeout(r, 500));
  }
}

(async () => {
  const [cmd, ...rest] = args;
  if (cmd === 'stop') { console.log(await stop()); return; }
  if (cmd === 'restart' && ['server', 'remote'].includes(rest[0])) { console.log(await stop()); await start(rest[0], rest.slice(1)); return; }
  if (['server', 'remote'].includes(cmd)) { await start(cmd, rest); return; }
  console.error('usage: node tools/drive/launch.js server|remote [options] | stop | restart server|remote [options]');
  process.exit(2);
})();

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
const net = require('net');

const PIDFILE = path.join(os.homedir(), '.onlykey-drive.pid');
const args = process.argv.slice(2);

const running = () => {
  try {
    const { pid, mode, rest } = JSON.parse(fs.readFileSync(PIDFILE, 'utf8'));
    process.kill(pid, 0);
    return { pid, mode, rest: Array.isArray(rest) ? rest : [] };
  } catch { return null; }
};

/* a port no longer answered on 127.0.0.1 - asked every 250 ms (another process's socket) until the watchdog's end */
function portClosed(port, until) {
  return new Promise((resolve) => {
    const check = () => {
      const s = net.connect({ host: '127.0.0.1', port }, () => { s.destroy(); if (Date.now() > until) resolve(false); else setTimeout(check, 250); });
      s.on('error', () => resolve(true));
    };
    check();
  });
}

/* the window closed: its process gone - not our child, so its end is checked (every 250 ms) under a 20 s watchdog */
function stop() {
  const r = running();
  if (!r) { try { fs.unlinkSync(PIDFILE); } catch { /* none */ } return Promise.resolve('not running'); }
  try { process.kill(r.pid); } catch { /* gone */ }
  return new Promise((resolve) => {
    const until = Date.now() + 20000;
    const check = () => {
      try { process.kill(r.pid, 0); } catch {
        try { fs.unlinkSync(PIDFILE); } catch { /* gone */ }
        /*
         * and its port closed: on Windows the NW.js process holding it outlives the window's own for a moment, and a
         * start's ready check answered by the old one returned "ready" for a server that then went (2026-10-31)
         */
        portClosed(r.mode === 'server' ? 8790 : 8791, until).then(() => resolve(`drive ${r.mode} stopped (pid ${r.pid})`));
        return;
      }
      /*
       * NOT STOPPED IN 20 s: ended, its whole tree, by its pid (2026-11-01: a window locked up under a flood of lines
       * outlived the 20 s, the restart went on, and the new server crashed on the port the old one still held)
       */
      if (Date.now() > until) {
        if (!r.forced) {
          r.forced = true;
          if (process.platform === 'win32') require('child_process').spawnSync('taskkill', ['/PID', String(r.pid), '/T', '/F'], { windowsHide: true });
          else { try { process.kill(r.pid, 'SIGKILL'); } catch { /* gone */ } }
          setTimeout(check, 500);
          return;
        }
        resolve(`drive ${r.mode} (pid ${r.pid}) did not stop, even forced`);
        return;
      }
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
  /* NW.js's own output (its stderr is where a crash below the server's handlers lands) - kept, not ignored */
  const logs = process.env.DRIVE_LOGS || path.join(os.homedir(), process.platform === 'linux' ? 'project/onlykey/logs' : 'drive-logs');
  fs.mkdirSync(logs, { recursive: true });
  const out = fs.openSync(path.join(logs, `drive-nw-${mode}.log`), 'a');
  /*
   * THE SERVER'S LOG WHERE wake.js READS IT (2026-11-01: a server started without DRIVE_LOG wrote to
   * ~/project/onlykey/logs while the wake watcher read ~/drive-logs - Brad's signals reached nobody)
   */
  if (mode === 'server' && !env.DRIVE_LOG) env.DRIVE_LOG = path.join(logs, 'drive-server.log');
  const child = spawn(nwBin, [__dirname, mode, ...rest], { detached: true, stdio: ['ignore', out, out], env, windowsHide: false });
  child.unref();
  fs.writeFileSync(PIDFILE, JSON.stringify({ pid: child.pid, mode, rest }));
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
  /*
   * A RESTART KEEPS WHAT IT WAS STARTED WITH (2026-11-01: a plain "restart server" dropped --remote, the box's apps were
   * gone, and two runs waited out their 90 s on "webapp did not come back"): options given replace them; none, the same.
   */
  if (cmd === 'restart' && ['server', 'remote'].includes(rest[0])) {
    const was = running();
    const opts = rest.length > 1 ? rest.slice(1) : was && was.mode === rest[0] ? was.rest : [];
    if (opts.length) console.log(`drive ${rest[0]}: restarted with ${opts.join(' ')}`);
    console.log(await stop()); await start(rest[0], opts); return;
  }
  if (['server', 'remote'].includes(cmd)) { await start(cmd, rest); return; }
  console.error('usage: node tools/drive/launch.js server|remote [options] | stop | restart server|remote [options]');
  process.exit(2);
})();

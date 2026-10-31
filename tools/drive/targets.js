'use strict';
/*
 * THE TARGETS ON THIS MACHINE - start, stop, restart the apps a drive drives (Brad, 2026-10-31: "drive script can also
 * start/stop/restart webapp/desktop/android on its expected target"). Used by drive-remote on the machine the apps run
 * on, and by the drive server itself when the apps are on its own machine:
 *
 *   drive server (Windows) <-> drive-remote (Linux box) <-> the apps and their processes
 *   drive server (Linux)   <->                             the apps and their processes
 *
 * JAVASCRIPT ONLY (Brad: "they need to be javascript, so they're not OS dependent - javascript runs on all hosts"): no
 * shell, no pkill/pgrep; the same code on Linux and Windows. A target is the app's shell name: desktop, webapp, android.
 *
 * A process this module starts is its child: its exit is an event. A stop comes after the drive server asked the app
 * to close itself (src/drive/quit.ts), so it first waits for that exit - a kill on an app still closing lost what it had
 * not flushed (2026-10-31) - and only when the watchdog runs out is the process ended (SIGTERM, then SIGKILL).
 */
const { spawn, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const LINUX = process.platform === 'linux';
const EDGE = path.resolve(__dirname, '..', '..');
const ROOT = path.resolve(EDGE, '..');
/*
 * NODE ITSELF, for the processes started here that are Node programs (the soft key's host, the web app's server): inside
 * the drive app process.execPath is NW.js's binary, not Node (2026-10-31: the soft key host was started as an NW app,
 * "Cannot open ZIP archive okemu-host.js") - launch.js passes the Node that ran it as DRIVE_NODE.
 */
const NODE = process.env.DRIVE_NODE || process.execPath;
const LOGS = process.env.DRIVE_LOGS || path.join(os.homedir(), 'project/onlykey/logs');

function run(cmd, args) {
  return new Promise((resolve) => execFile(cmd, args, { cwd: EDGE, windowsHide: true }, (err, stdout, stderr) => resolve({ ok: !err, out: `${stdout}${stderr}`.trim() })));
}

/* the phones (ok-edge runs as com.okrn on them - memory a13-runs-ok-edge-as-okrn) */
const APP_ID = process.env.OKEDGE_APP_ID || 'com.okrn';
const ADB = (() => {
  const sdk = process.env.ANDROID_HOME || path.join(os.homedir(), LINUX ? 'Android/Sdk' : 'AppData/Local/Android/Sdk');
  const bin = path.join(sdk, 'platform-tools', LINUX ? 'adb' : 'adb.exe');
  return fs.existsSync(bin) ? bin : 'adb';
})();
const adb = (args) => run(ADB, ['-s', process.env.ANDROID_SERIAL || '26251JEGR09693', ...args]);

/* a long-running child of ours: its own process group (Linux), its output in a log */
function launch(name, cmd, args, env = {}) {
  try { fs.mkdirSync(LOGS, { recursive: true }); } catch { /* the log is a nicety */ }
  const out = fs.openSync(path.join(LOGS, `${name}.log`), 'w');
  return spawn(cmd, args, { cwd: EDGE, env: { ...process.env, ...env }, detached: LINUX, stdio: ['ignore', out, out], shell: !LINUX, windowsHide: false });
}

/*
 * A TARGET'S OUTPUT, AS IT IS WRITTEN (drive debugging #3): the file stays its sink - the app never depends on the drive
 * staying open - and this follows it by the file system's own change events (fs.watch: inotify), reading only what was
 * added, line by line. A file started again (a new launch truncates it) is read from its start.
 */
function follow(name, onLine) {
  const file = path.join(LOGS, `${name}.log`);
  let at = 0;
  let rest = '';
  const read = () => {
    let size;
    try { size = fs.statSync(file).size; } catch { return; }
    if (size < at) { at = 0; rest = ''; }
    if (size === at) return;
    const buf = Buffer.alloc(size - at);
    const fd = fs.openSync(file, 'r');
    try { fs.readSync(fd, buf, 0, buf.length, at); } finally { fs.closeSync(fd); }
    at = size;
    const lines = (rest + buf.toString('utf8')).split('\n');
    rest = lines.pop();
    for (const l of lines) if (l.trim()) onLine(l.replace(/\r$/, ''));
  };
  try { const w = fs.watch(file, read); read(); return w; } catch { return null; }
}

/* a short command in a folder, under its watchdog */
function runIn(cwd, cmd, args, timeout) {
  return new Promise((resolve) => execFile(cmd, args, { cwd, windowsHide: true, timeout }, (err, stdout, stderr) => resolve({ ok: !err, out: `${stdout}${stderr}`.trim() })));
}

/*
 * THE WEB APP'S KEY (was tools/box/softkey-gadget.sh): the testnet SOFT key as a real USB OnlyKey on the box (the
 * emulator's dummy_hcd gadget), so the browser reaches it over WebAuthn - or hard key 2 (DRIVE_WEBAPP_KEY=hard). The
 * gadget runs a COPY of the box desktop app's testnet soft key: two firmware runs on one flash would corrupt it. The
 * firmware's own restart (CPU_RESTART: config mode, a wipe, its timeouts) ends the emulator process; its exit is the
 * event to start it again on the same storage, so it comes back the way a hard key does. It outlives the browser: a
 * web app restart is a page reload, not a key unplugged.
 */
const KEY = process.env.DRIVE_WEBAPP_KEY === 'hard' ? 'hard' : 'gadget';
/* the site the box's keys carry (ctap_bridge's default) - where "Go to <site>" sends the web app */
const KEY_SITE = process.env.DRIVE_KEY_SITE || 'ok-edge.bmatusiak.workers.dev';
/* the web app's processes, by their command lines: its browser profile, its local Worker (wrangler dev, workerd) */
const webappProc = (cmd) => cmd.includes('webapp-chromium') || cmd.includes('serve-docs.js') || (cmd.includes('wrangler') && cmd.includes('\0dev\0')) || cmd.includes('workerd\0serve');
const EMU = process.env.EMU || path.join(ROOT, 'node-onlykey-emulator', 'emulator');
const GADGET_STORE = path.join(ROOT, 'webapp-softkey');
const GADGET_SRC = path.join(os.homedir(), '.config/Electron-test/okemu/plugins-config.edge-test');
const GADGET_SOCK = '/tmp/okemu-webapp.sock';
let gadgetChild = null;
let gadgetStopping = false;
function gadgetElsewhere() {
  if (!LINUX) return [];
  return fs.readdirSync('/proc').filter((d) => /^\d+$/.test(d)).filter((d) => {
    try { return fs.readFileSync(`/proc/${d}/cmdline`, 'utf8').includes(`bin/daemon.js\0--storage\0${GADGET_STORE}`); } catch { return false; }
  }).map(Number);
}
function gadget() {
  if (gadgetChild && !exited(gadgetChild)) return 'its gadget soft key already runs';
  const other = gadgetElsewhere();
  if (other.length) return `its gadget soft key already runs (pid ${other.join(', ')}, not started here)`;
  if (!fs.existsSync(GADGET_STORE)) fs.cpSync(GADGET_SRC, GADGET_STORE, { recursive: true });
  gadgetStopping = false;
  const startOne = () => {
    gadgetChild = spawn(NODE, ['bin/daemon.js', '--storage', GADGET_STORE, '--socket', GADGET_SOCK], {
      cwd: EMU, detached: LINUX, stdio: ['ignore', fs.openSync(path.join(LOGS, 'webapp-softkey.log'), 'a'), fs.openSync(path.join(LOGS, 'webapp-softkey.log'), 'a')],
    });
    gadgetChild.once('exit', () => { if (!gadgetStopping) startOne(); });
  };
  startOne();
  return `its gadget soft key started (${GADGET_STORE})`;
}

/*
 * THE GADGET'S OWN SOCKET, HELD HERE (the emulator dials its controller; one controller at a time - press.js's rule):
 * the key's LED and console come in as events, and its presses go out, through the one connection. What the LED shows
 * is the key's state - the web app cannot see it (its key is outside the browser), the machine holding the key can.
 * "[gadget]" lines go to the web app's tab (#3's path: the testnet every line, the live chain none).
 */
let gadgetHost = null;
let gadgetUp = false;
let gadgetLed = { hex: null, at: 0 };
let gadgetOut = () => {};
function holdGadget(onOut) {
  gadgetOut = onOut;
  if (gadgetHost) return null;
  const IpcHost = require(path.join(EMU, 'lib', 'ipc-host'));
  const host = new IpcHost({ socketPath: GADGET_SOCK });
  try { host.listen(); } catch (e) { return `could not hold the gadget's socket: ${e.message} (a press.js or GUI holds it?)`; }
  gadgetHost = host;
  host.on('device-connect', () => { gadgetUp = true; gadgetOut('[gadget] the soft key connected'); });
  host.on('device-disconnect', () => { gadgetUp = false; gadgetOut('[gadget] the soft key went (it starts again by itself)'); });
  host.on('led', (m) => {
    const hex = (m.pixels || []).map((p) => `#${[p.r, p.g, p.b].map((v) => v.toString(16).padStart(2, '0')).join('')}`).join(' ');
    if (hex === gadgetLed.hex) return;
    gadgetLed = { hex, at: Date.now() };
    /* off between blinks is not news: a waiting key blinks */
    if (!/^(#000000 ?)+$/.test(hex)) gadgetOut(`[gadget] led ${hex}`);
  });
  host.on('log', (m) => { for (const l of String(m.text || '').split('\n')) if (l.trim()) gadgetOut(`[gadget] ${l}`); });
  return null;
}

/* the end of a target's output log (launch() writes LOGS/<name>.log) */
function tail(name, n) {
  try { return fs.readFileSync(path.join(LOGS, `${name}.log`), 'utf8').split('\n').slice(-n).join('\n'); } catch (e) { return `(no log: ${e.message})`; }
}

const exited = (child) => child.exitCode !== null || child.signalCode !== null;
/* the child's own exit event, or the watchdog */
const exitOf = (child, ms) => new Promise((resolve) => {
  if (exited(child)) return resolve(true);
  const dog = setTimeout(() => resolve(false), ms);
  child.once('exit', () => { clearTimeout(dog); resolve(true); });
});

/* ended as a whole: its group on Linux, its tree on Windows (taskkill is Windows' own way) */
function end(child, signal) {
  if (LINUX) { try { process.kill(-child.pid, signal); } catch { /* gone */ } return; }
  execFile('taskkill', ['/PID', String(child.pid), '/T', ...(signal === 'SIGKILL' ? ['/F'] : [])], { windowsHide: true }, () => {});
}

/* waits for a child to go by itself (an app asked to quit), then ends it if it does not */
async function stopChild(child, line, name) {
  if (!child || exited(child)) return 'not running';
  if (await exitOf(child, 20000)) return 'closed by itself';
  line(`${name}: still running 20 s after it was asked to close - ending it`);
  end(child, 'SIGTERM');
  if (await exitOf(child, 10000)) return 'ended';
  end(child, 'SIGKILL');
  await exitOf(child, 5000);
  return 'killed';
}

/*
 * LINUX ONLY: ok-edge Electron processes this module did not start (one opened by hand) - read from /proc, matched by
 * their own command line (never the caller's). Their exit is not an event to us (not our children), so it is checked
 * every 250 ms under the watchdog - the one place a process's end can only be looked at.
 */
function strayElectrons() {
  if (!LINUX) return [];
  const out = [];
  for (const d of fs.readdirSync('/proc')) {
    if (!/^\d+$/.test(d) || Number(d) === process.pid) continue;
    let cmd = '';
    try { cmd = fs.readFileSync(`/proc/${d}/cmdline`, 'utf8'); } catch { continue; }
    if (cmd.includes(`${EDGE}/node_modules/electron`) || cmd.startsWith('node\0electron/start.js')) out.push(Number(d));
  }
  return out;
}
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
/*
 * processes this module did not start, ended by pid: first `grace` ms to close by themselves (an app asked to quit),
 * then SIGTERM and 10 s, then SIGKILL. Not our children - their end is checked every 250 ms under each watchdog.
 */
async function endPids(pids, line, name, grace = 0) {
  const gone = (ms) => new Promise((resolve) => {
    const until = Date.now() + ms;
    const check = () => { pids = pids.filter(alive); if (!pids.length) return resolve(true); if (Date.now() > until) return resolve(false); setTimeout(check, 250); };
    check();
  });
  if (grace && await gone(grace)) return 'closed by itself';
  line(`${name}: ${pids.length} process(es) not started here still running - ending them`);
  for (const p of pids) { try { process.kill(p, 'SIGTERM'); } catch { /* gone */ } }
  if (await gone(10000)) return 'ended';
  for (const p of pids) { try { process.kill(p, 'SIGKILL'); } catch { /* gone */ } }
  return 'killed';
}
/* the desktop app's Electron processes not started here: it was asked to quit, so 20 s to close by itself first */
async function endStrays(line) {
  const pids = strayElectrons();
  return pids.length ? endPids(pids, line, 'desktop', 20000) : null;
}

/*
 * createTargets(line, out): line(text) is this machine's own log; out(shell, text) is a target's output, line by line,
 * for the drive's tab of that app (#3).
 */
function createTargets(line = () => {}, out = () => {}) {
  const running = new Map(); /* target -> its child (or children) */
  const followers = new Map(); /* target -> its output's watcher */
  const followOut = (target, name) => {
    if (followers.get(target)) followers.get(target).close();
    followers.set(target, follow(name, (l) => out(target, l)));
  };

  const T = {
    desktop: {
      async start() {
        const c = running.get('desktop');
        if ((c && !exited(c)) || strayElectrons().length) return 'already running';
        const env = { ...(LINUX ? { OKEDGE_NODE: NODE, DISPLAY: process.env.DRIVE_DISPLAY || ':10' } : {}) };
        const child = launch('desktop-test', LINUX ? 'npm' : 'npm.cmd', ['run', 'electron:test', ...(LINUX ? ['--', '--no-sandbox'] : [])], env);
        /* kept after it exits: its exit code is its last words (lastWords); the next start replaces it */
        running.set('desktop', child);
        followOut('desktop', 'desktop-test');
        return 'started';
      },
      async stop() {
        const r = await stopChild(running.get('desktop'), line, 'desktop');
        running.delete('desktop');
        return (await endStrays(line)) || r;
      },
    },
    webapp: {
      /* the box's web app: docs/ served as https://apps.crp.to:8443 and Chromium on the box screen (as tools/box/webapp.sh did) */
      async start() {
        if (!LINUX) return 'the web app target is the Linux box\'s';
        /* its key first: the gadget held and running, whatever else already runs */
        if (KEY === 'gadget') {
          const held = holdGadget((l) => out('webapp', l));
          if (held) line(`webapp: ${held}`);
        }
        const keyNote = KEY === 'gadget' ? gadget() : 'its key: hard key 2 on this USB';
        const c = running.get('webapp');
        if (c && c.some((x) => !exited(x))) return `already running (${keyNote})`;
        /* started by a drive-remote before this one (its children outlive it): found by their command lines */
        const found = procs(webappProc);
        if (found && found.length) return `already running, not started here (pids ${found.map((p) => p.pid).join(', ')}; ${keyNote})`;
        /*
         * THE WEB APP AS IT IS DEPLOYED, ON THIS BOX (Brad, 2026-10-31: "go to apps.crp.to first and redirect to the set
         * rpid the key provides"): the local Worker (mcp-server, wrangler dev - the --dev web app in docs/, its rooms and
         * MCP) on 443 for BOTH names, with the dev certificate that names both; Chromium maps both to this box and starts
         * at apps.crp.to. The app reads the key's site and its "Go to <site>" lands on the same Worker, as it lands on
         * Cloudflare in production. 443 needs the box's unprivileged port floor at 443 (/etc/sysctl.d/60-okedge-443.conf).
         */
        const certs = path.join(ROOT, 'devcert');
        const server = launch('server-dev', 'npx', ['--yes', 'wrangler@4.153.0', 'dev', '--ip', '0.0.0.0', '--port', '443', '--local-protocol', 'https',
          '--var', 'SEALED_IDENTITIES:*', '--https-key-path', path.join(certs, 'apps.crp.to.key'), '--https-cert-path', path.join(certs, 'apps.crp.to.crt')]);
        /* the browser once the Worker says it is ready - its own line, followed in its log (3 minutes: a first build) */
        const ready = await new Promise((resolve) => {
          const dog = setTimeout(() => { w && w.close(); resolve(null); }, 180000);
          const w = follow('server-dev', (l) => { if (/Ready on|✘/.test(l)) { clearTimeout(dog); w && w.close(); resolve(l); } });
        });
        if (!ready || /✘/.test(ready)) return `the local Worker did not start: ${ready || 'no "Ready on" in 3 minutes'} (logs/server-dev.log)`;
        const spki = fs.readFileSync(path.join(certs, 'apps.crp.to.spki'), 'utf8').trim();
        const browser = launch('webapp-chromium', 'chromium-browser', ['--test-type', '--remote-debugging-port=9333',
          `--host-resolver-rules=MAP apps.crp.to 127.0.0.1, MAP ${KEY_SITE} 127.0.0.1`,
          `--ignore-certificate-errors-spki-list=${spki}`, `--user-data-dir=${path.join(ROOT, 'webapp-chromium')}`, '--no-first-run', '--new-window', 'https://apps.crp.to/'],
        { DISPLAY: process.env.DRIVE_DISPLAY || ':10' });
        running.set('webapp', [server, browser]);
        followOut('webapp', 'webapp-chromium');
        return `started at https://apps.crp.to/ (the key's site ${KEY_SITE} on the same local Worker; ${keyNote})`;
      },
      /*
       * THE BROWSER'S WINDOW, PICTURED BY ITS MACHINE (Brad, 2026-10-31: "the webapp screenshot does not see the security
       * key dialog"): the page draws only itself (src/drive/shot.webapp.ts); Chrome's own dialogs are the browser's, so
       * the machine running it takes the window too - the one picture an app cannot take of itself. -> PNG base64.
       */
      async windowShot() {
        if (!LINUX) return { why: 'the browser window is pictured on Linux only so far' };
        const env = { ...process.env, DISPLAY: process.env.DRIVE_DISPLAY || ':10' };
        const id = await new Promise((resolve) => execFile('xdotool', ['search', '--onlyvisible', '--class', 'chromium'], { env }, (err, out) => resolve(err ? '' : String(out).trim().split('\n').pop())));
        if (!id) return { why: 'no Chromium window on the screen' };
        return new Promise((resolve) => execFile('import', ['-window', id, 'png:-'], { env, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 }, (err, out) => resolve(err ? { why: `import: ${err.message}` } : { png: out.toString('base64') })));
      },
      /* the web app's key as its machine sees it (the gadget's LED now, and since when) */
      async keyState() {
        if (KEY === 'hard') return 'hard key 2: read it with tools/box/owner-key.js';
        if (!gadgetHost) return 'the gadget is not held here (start the web app through the drive)';
        return `the testnet soft key (gadget): ${gadgetUp ? 'connected' : 'not connected'}; led ${gadgetLed.hex || 'not seen yet'}${gadgetLed.at ? ` for ${Math.round((Date.now() - gadgetLed.at) / 1000)} s` : ''}`;
      },
      /*
       * A PRESS ON THE WEB APP'S KEY (the drive's answer to "[press] key waits", src/hostChallenge.ts): the key is outside
       * the browser, so this machine presses it - the gadget soft key through the emulator's own socket, or hard key 2
       * through its DEBUG console (DRIVE_WEBAPP_KEY=hard; tools/box/hardkey-press.js). buttons: ['1'] or a code.
       */
      async press({ buttons = ['1'] } = {}) {
        const b = (Array.isArray(buttons) ? buttons : String(buttons).split(/\s+/)).filter((x) => /^[1-6]$/.test(x));
        if (!b.length) b.push('1');
        if (KEY === 'gadget') {
          if (!gadgetHost) return 'press failed: the gadget is not held here (start the web app through the drive)';
          /* it redials its controller with a backoff (up to 5 s): its connect is the event, 15 s the watchdog */
          if (!gadgetUp) {
            await new Promise((resolve) => {
              const dog = setTimeout(done, 15000);
              function done() { clearTimeout(dog); gadgetHost.off('device-connect', done); resolve(); }
              gadgetHost.once('device-connect', done);
            });
          }
          if (!gadgetUp) return 'press failed: the gadget soft key did not connect to this machine in 15 s';
          for (const x of b) gadgetHost.press(Number(x), 'tap');
          return `pressed ${b.join(' ')} on the gadget soft key`;
        }
        const r = await runIn(EDGE, NODE, [path.join(EDGE, 'tools/box/hardkey-press.js'), ...b], 70000);
        return r.ok ? `pressed ${b.join(' ')} on the hard key` : `press failed: ${r.out.split('\n').pop()}`;
      },
      async stop() {
        const c = running.get('webapp') || [];
        running.delete('webapp');
        const r = [];
        for (const x of c) r.push(await stopChild(x, line, 'webapp'));
        /*
         * and its browser and server if an earlier drive-remote started them (they outlive it): found by their own
         * command lines, ended by pid - the same watchdog as a stray desktop app's (endPids). Its key, the gadget, stays.
         */
        const left = (procs(webappProc) || []).map((p) => p.pid);
        if (left.length) r.push(await endPids(left, line, 'webapp'));
        return r.join(', ') || 'not running';
      },
    },
    android: {
      /*
       * The bench phone: ANDROID_SERIAL, else the Pixel (the same default as tools/box/pixel-build.sh) - the box's adb
       * lists it twice (USB and wireless) and a plain adb then refuses "more than one device". adb from the SDK, as the
       * drive app's PATH may not have platform-tools. Its app dials the drive port on the phone, reversed to here.
       */
      async start() {
        const port = process.env.DRIVE_PORT || '8790';
        const rev = await adb(['reverse', `tcp:${port}`, `tcp:${port}`]);
        if (!rev.ok) return `adb reverse: ${rev.out}`;
        const r = await adb(['shell', 'am', 'start', '-n', `${APP_ID}/com.okedge.MainActivity`]);
        return r.ok ? 'started' : r.out;
      },
      async stop() {
        const r = await adb(['shell', 'am', 'force-stop', APP_ID]);
        return r.ok ? 'stopped' : r.out;
      },
    },
  };

  /*
   * LAST WORDS (drive debugging #1, Brad 2026-10-31: "yes i like it all"): an app that went without being asked cannot
   * say why - the machine it ran on can. Android keeps a crash buffer and its own record of why each process ended
   * (ApplicationExitInfo: crash, native crash, low memory, killed); a desktop or web app here is our child, so its exit
   * code and the end of its output log say it.
   */
  const exitOf_ = (c) => (!c ? 'not started here' : exited(c) ? `exited: code ${c.exitCode}${c.signalCode ? `, signal ${c.signalCode}` : ''}` : `still running (pid ${c.pid}) - the app closed its connection, the process did not end`);
  const lastWords = {
    async android() {
      const why = await adb(['shell', 'dumpsys', 'activity', 'exit-info', APP_ID]);
      const crash = await adb(['logcat', '-b', 'crash', '-d', '-t', '80']);
      const first = why.out.split('\n').filter((l) => /ApplicationExitInfo|reason|description|timestamp|importance/i.test(l)).slice(0, 8).join('\n');
      return `== Android's record of the last exits (dumpsys activity exit-info ${APP_ID})\n${first || why.out.slice(0, 1500)}\n\n== the crash buffer (logcat -b crash, last 80)\n${crash.out || '(empty)'}`;
    },
    async desktop() {
      return `== the process: ${exitOf_(running.get('desktop'))}\n\n== the end of its output (logs/desktop-test.log)\n${tail('desktop-test', 60)}`;
    },
    async webapp() {
      const [serve, browser] = running.get('webapp') || [];
      return `== the server: ${exitOf_(serve)}\n== the browser: ${exitOf_(browser)}\n\n== the browser's output (logs/webapp-chromium.log)\n${tail('webapp-chromium', 40)}\n\n== the server's output (logs/serve-docs.log)\n${tail('serve-docs', 20)}`;
    },
  };

  /*
   * HEALTH (drive debugging #7): how big and how busy an app's processes are, read where they run - Android's own
   * meminfo and top; on Linux every process of the app from /proc (resident memory, and CPU time used so far).
   */
  const procs = (test) => {
    if (!LINUX) return null;
    const tick = 100; /* USER_HZ on Linux */
    const out = [];
    for (const d of fs.readdirSync('/proc')) {
      if (!/^\d+$/.test(d)) continue;
      let cmd = '';
      try { cmd = fs.readFileSync(`/proc/${d}/cmdline`, 'utf8'); } catch { continue; }
      if (!test(cmd)) continue;
      try {
        const rss = Number((/VmRSS:\s+(\d+)/.exec(fs.readFileSync(`/proc/${d}/status`, 'utf8')) || [])[1] || 0);
        const stat = fs.readFileSync(`/proc/${d}/stat`, 'utf8').split(') ')[1].split(' ');
        out.push({ pid: Number(d), rssKb: rss, cpuS: (Number(stat[11]) + Number(stat[12])) / tick, name: cmd.split('\0')[0].split('/').pop() });
      } catch { /* gone while read */ }
    }
    return out;
  };
  const sumUp = (list) => (!list ? 'measured on Linux only' : !list.length ? 'no process running'
    : `${list.length} process(es), ${Math.round(list.reduce((n, p) => n + p.rssKb, 0) / 1024)} MB resident, ${list.reduce((n, p) => n + p.cpuS, 0).toFixed(1)} s of CPU so far\n${list.map((p) => `  ${p.pid} ${p.name}: ${Math.round(p.rssKb / 1024)} MB, ${p.cpuS.toFixed(1)} s`).join('\n')}`);
  const health = {
    async android() {
      const mem = await adb(['shell', 'dumpsys', 'meminfo', APP_ID]);
      const pid = (await adb(['shell', 'pidof', APP_ID])).out.trim();
      const top = pid ? await adb(['shell', 'top', '-b', '-n', '1', '-p', pid]) : { out: '' };
      const total = mem.out.split('\n').filter((l) => /TOTAL PSS|TOTAL RSS|^\s*TOTAL\s/.test(l)).slice(0, 2).join('\n');
      const cpu = top.out.split('\n').filter((l) => l.includes(pid) && pid).slice(0, 1).join('\n');
      return `pid ${pid || '(not running)'}\n${total || '(no meminfo)'}\n${cpu ? `top: ${cpu.trim()}` : ''}`;
    },
    async desktop() { return sumUp(procs((c) => c.includes(`${EDGE}/node_modules/electron`) || c.startsWith('node\0electron/start.js') || c.includes('okemu-host'))); },
    async webapp() { return sumUp(procs((c) => c.includes('webapp-chromium') || c.includes('serve-docs.js'))); },
  };

  /*
   * BLUETOOTH, CAPTURED BEFORE ANYTHING CURES IT (drive debugging #8; memory: capture Bluetooth before curing): ok-rn's
   * btcapture.js, read-only, run where the phone's adb is - this machine's own Bluetooth view (bluetoothctl / Windows'
   * services) and the phone's (GATT table, the app's [bt]/[ble] lines, never [fw]). Its watchdog: 3 minutes.
   */
  async function btCapture() {
    const tool = path.join(ROOT, 'ok-rn', 'tools', 'btcapture.js');
    if (!fs.existsSync(tool)) return { ok: false, why: `no ${tool} on this machine` };
    const phone = process.env.DRIVE_BT_PHONE || 'Pixel 6a';
    const mac = process.env.DRIVE_BT_MAC || '24:29:34:86:EA:AF';
    return new Promise((resolve) => execFile(NODE, [tool, '--phone', phone, '--mac', mac], {
      cwd: path.dirname(path.dirname(tool)), windowsHide: true, timeout: 180000,
      env: { ...process.env, ANDROID_SERIAL: process.env.ANDROID_SERIAL || '26251JEGR09693', PATH: `${path.dirname(ADB)}${path.delimiter}${process.env.PATH}` },
    }, (err, stdout, stderr) => resolve({ ok: true, what: `${stdout}${stderr}`.trim() || (err ? err.message : '(no output)') })));
  }

  return {
    list: Object.keys(T),
    async act(action, target, args = {}) {
      const t = T[target];
      if (!t) return { ok: false, why: `no target "${target}" (${Object.keys(T).join(', ')})` };
      if (action === 'start') return { ok: true, what: await t.start() };
      if (action === 'stop') return { ok: true, what: await t.stop() };
      if (action === 'restart') { const s = await t.stop(); return { ok: true, what: `${s}; ${await t.start()}` }; }
      if (action === 'last-words') return { ok: true, what: await lastWords[target]() };
      if (action === 'health') return { ok: true, what: await health[target]() };
      if (action === 'bt-capture') return btCapture();
      if (action === 'window-shot') { if (!t.windowShot) return { ok: false, why: `${target} pictures its whole self` }; const w = await t.windowShot(); return w.png ? { ok: true, what: w.png } : { ok: false, why: w.why }; }
      if (action === 'key-state') return t.keyState ? { ok: true, what: await t.keyState() } : { ok: false, why: `${target}'s key is in the app: its flags say its state` };
      if (action === 'press') return t.press ? { ok: true, what: await t.press(args) } : { ok: false, why: `${target}'s key is in the app: the drive taps its own button` };
      return { ok: false, why: `no action "${action}"` };
    },
  };
}

module.exports = { createTargets };

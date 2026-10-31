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
async function endStrays(line) {
  let pids = strayElectrons();
  if (!pids.length) return null;
  const gone = (ms) => new Promise((resolve) => {
    const until = Date.now() + ms;
    const check = () => { pids = pids.filter(alive); if (!pids.length) return resolve(true); if (Date.now() > until) return resolve(false); setTimeout(check, 250); };
    check();
  });
  if (await gone(20000)) return 'closed by itself';
  line(`desktop: ${pids.length} process(es) not started here still running - ending them`);
  for (const p of pids) { try { process.kill(p, 'SIGTERM'); } catch { /* gone */ } }
  if (await gone(10000)) return 'ended';
  for (const p of pids) { try { process.kill(p, 'SIGKILL'); } catch { /* gone */ } }
  return 'killed';
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
        const env = { ...(LINUX ? { OKEDGE_NODE: process.execPath, DISPLAY: process.env.DRIVE_DISPLAY || ':10' } : {}) };
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
        const c = running.get('webapp');
        if (c && c.some((x) => !exited(x))) return 'already running';
        const spki = fs.readFileSync(path.join(ROOT, 'devcert/apps.crp.to.spki'), 'utf8').trim();
        const serve = launch('serve-docs', process.execPath, [path.join(EDGE, 'tools/box/serve-docs.js'), path.join(EDGE, 'docs'), path.join(ROOT, 'devcert'), '8443']);
        const browser = launch('webapp-chromium', 'chromium-browser', ['--test-type', '--remote-debugging-port=9333', '--host-resolver-rules=MAP apps.crp.to 127.0.0.1',
          `--ignore-certificate-errors-spki-list=${spki}`, `--user-data-dir=${path.join(ROOT, 'webapp-chromium')}`, '--no-first-run', '--new-window', 'https://apps.crp.to:8443/'],
        { DISPLAY: process.env.DRIVE_DISPLAY || ':10' });
        running.set('webapp', [serve, browser]);
        followOut('webapp', 'webapp-chromium');
        return 'started';
      },
      async stop() {
        const c = running.get('webapp') || [];
        running.delete('webapp');
        const r = [];
        for (const x of c) r.push(await stopChild(x, line, 'webapp'));
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

  return {
    list: Object.keys(T),
    async act(action, target) {
      const t = T[target];
      if (!t) return { ok: false, why: `no target "${target}" (${Object.keys(T).join(', ')})` };
      if (action === 'start') return { ok: true, what: await t.start() };
      if (action === 'stop') return { ok: true, what: await t.stop() };
      if (action === 'restart') { const s = await t.stop(); return { ok: true, what: `${s}; ${await t.start()}` }; }
      if (action === 'last-words') return { ok: true, what: await lastWords[target]() };
      return { ok: false, why: `no action "${action}"` };
    },
  };
}

module.exports = { createTargets };

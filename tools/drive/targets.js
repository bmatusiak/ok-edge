'use strict';
/*
 * THE TARGETS ON THIS MACHINE - start, stop, restart the apps a drive drives (Brad, 2026-10-31: "drive script can also
 * start/stop/restart webapp/desktop/android on its expected target"). Used by drive-remote on the machine the apps run
 * on, and by the drive server itself when the apps are on its own machine:
 *
 *   drive server (Windows) <-> drive-remote (Linux box) <-> the apps and their processes
 *   drive server (Linux)   <->                             the apps and their processes
 *
 * A target is the app's shell name: desktop, webapp, android. A process this module starts runs in its own process
 * group and is stopped as a group; a stop ends on the process's own exit event (its watchdog: 20 s, then SIGKILL).
 */
const { spawn, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const LINUX = process.platform === 'linux';
const EDGE = path.resolve(__dirname, '..', '..');
const LOGS = process.env.DRIVE_LOGS || path.join(os.homedir(), 'project/onlykey/logs');

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => execFile(cmd, args, { cwd: EDGE, ...opts }, (err, stdout, stderr) => resolve({ ok: !err, out: `${stdout}${stderr}`.trim() })));
}

/* a long-running process of ours: its own group, its output in a log */
function launch(name, cmd, args, env = {}) {
  try { fs.mkdirSync(LOGS, { recursive: true }); } catch { /* the log is a nicety */ }
  const out = fs.openSync(path.join(LOGS, `${name}.log`), 'w');
  const child = spawn(cmd, args, { cwd: EDGE, env: { ...process.env, ...env }, detached: true, stdio: ['ignore', out, out], shell: !LINUX });
  child.unref();
  return child;
}

function stopGroup(child) {
  return new Promise((resolve) => {
    if (!child || child.exitCode !== null) return resolve('not running');
    const dog = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* gone */ } }, 20000);
    child.once('exit', () => { clearTimeout(dog); resolve('stopped'); });
    try { process.kill(LINUX ? -child.pid : child.pid, 'SIGTERM'); } catch { clearTimeout(dog); resolve('gone'); }
  });
}

function createTargets() {
  const running = new Map(); /* target -> child */
  const nodeBin = process.execPath;

  const T = {
    desktop: {
      async start() {
        const env = LINUX
          ? { OKEDGE_NODE: nodeBin, DISPLAY: process.env.DRIVE_DISPLAY || ':10', OKEDGE_DEVTOOLS_PORT: '9334' }
          : { OKEDGE_DEVTOOLS_PORT: '9334' };
        const args = LINUX ? ['run', 'electron:test', '--', '--no-sandbox'] : ['run', 'electron:test'];
        running.set('desktop', launch('desktop-test', LINUX ? 'npm' : 'npm.cmd', args, env));
        return 'started';
      },
      async stop() {
        const child = running.get('desktop');
        running.delete('desktop');
        if (child) return stopGroup(child);
        /* one this module did not start (tools/box/desktop-test.sh, a person): its processes by pid, as that script
         * stops them, and their exits waited for - never a pattern that could match the caller's own command */
        if (!LINUX) return 'not started here';
        const r = await run('bash', ['-c', 'p="$(pgrep -x electron) $(pgrep -f \'^node electron/start.js\')"; [ -z "${p// /}" ] && { echo none; exit 0; }; kill $p 2>/dev/null; for x in $p; do timeout 20 tail --pid=$x -f /dev/null; done; echo stopped']);
        return r.out || 'stopped';
      },
    },
    webapp: {
      async start() {
        if (!LINUX) return 'the web app target runs on the Linux box (tools/box/webapp.sh)';
        const a = await run('bash', ['tools/box/webapp.sh', 'serve']);
        const b = await run('bash', ['tools/box/webapp.sh', 'browser']);
        return a.ok && b.ok ? 'started' : `${a.out}\n${b.out}`;
      },
      async stop() {
        if (!LINUX) return 'not here';
        const r = await run('bash', ['tools/box/webapp.sh', 'stop']);
        return r.ok ? 'stopped' : r.out;
      },
    },
    android: {
      /* the phone adb sees (ANDROID_SERIAL picks one); its app dials the drive port on the phone, reversed to this machine */
      async start() {
        const port = process.env.DRIVE_PORT || '8790';
        const rev = await run('adb', ['reverse', `tcp:${port}`, `tcp:${port}`]);
        if (!rev.ok) return `adb reverse: ${rev.out}`;
        const r = await run('adb', ['shell', 'am', 'start', '-n', `${process.env.OKEDGE_APP_ID || 'com.okrn'}/.MainActivity`]);
        return r.ok ? 'started' : r.out;
      },
      async stop() {
        const r = await run('adb', ['shell', 'am', 'force-stop', process.env.OKEDGE_APP_ID || 'com.okrn']);
        return r.ok ? 'stopped' : r.out;
      },
    },
  };

  return {
    list: Object.keys(T),
    async act(action, target) {
      const t = T[target];
      if (!t) return { ok: false, why: `no target "${target}" (${Object.keys(T).join(', ')})` };
      if (action === 'start') return { ok: true, what: await t.start() };
      if (action === 'stop') return { ok: true, what: await t.stop() };
      if (action === 'restart') { await t.stop(); return { ok: true, what: await t.start() }; }
      return { ok: false, why: `no action "${action}"` };
    },
  };
}

module.exports = { createTargets };

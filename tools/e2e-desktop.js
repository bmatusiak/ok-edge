#!/usr/bin/env node
/*
 * ok-rn's in-app e2e suites, on the DESKTOP shell (ok-edge stage 4): the same suites tools/e2e.js
 * runs on the phone, run in Electron against the desktop's own soft key.
 *
 *   node tools/e2e-desktop.js [--only a,b] [--no-bail]
 *
 * Testing mode is a development build's only (the release bundle swaps TestingScreen out), so the
 * page is the development bundle from ok-edge's Metro (metro.pm2.config.js, port 8082 - it serves
 * the web page too). Electron loads it, runs tools/e2e-desktop-drive.js in the page (Enter testing
 * mode, Menu, Testing, RUN TESTS) and prints the page's console; this script follows the
 * "[Moniker]" lines, stops at TEST COMPLETE, and reports the verdict line as tools/e2e.js does -
 * PASS/FAIL passed= failed= skipped=. --only and --no-bail change __e2e_tests__/only.js and
 * runOptions.js as tools/e2e.js does, and put them back after.
 *
 * Suites that need the phone (USB, the computer link, biometrics...) meet the desktop's honest
 * absences (src/desktop/specs) and skip or fail on them - that is the desktop's answer to read.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const URL = process.env.OKEDGE_WEB_URL || 'http://localhost:8082';
const BUDGET_MS = Number(process.env.OKRN_E2E_TIMEOUT_MS || 1800000);
const STALL_MS = Number(process.env.OKRN_E2E_STALL_MS || 180000);

/* --only / --no-bail: tools/e2e.js's own handling of the two files, the same rules */
const ONLY_FILE = path.join(ROOT, '__e2e_tests__', 'only.js');
const OPTIONS_FILE = path.join(ROOT, '__e2e_tests__', 'runOptions.js');
function arg(name) {
  const at = process.argv.indexOf(name);
  if (at === -1) return null;
  const v = process.argv[at + 1];
  if (!v || v.startsWith('--')) throw new Error(`${name} needs a value`);
  return v;
}
function rewrite(file, pattern, clean, wanted) {
  const original = fs.readFileSync(file, 'utf8');
  const restore = () => fs.writeFileSync(file, original.replace(pattern, clean));
  if (wanted === clean) { if (original.replace(pattern, clean) !== original) restore(); return () => {}; }
  fs.writeFileSync(file, original.replace(pattern, wanted));
  return restore;
}

async function main() {
  const only = (arg('--only') || '').split(',').map((s) => s.trim()).filter(Boolean);
  const restoreOnly = rewrite(ONLY_FILE, /module\.exports = \[[^\]]*\];/, 'module.exports = [];',
    only.length ? `module.exports = ${JSON.stringify(only)};` : 'module.exports = [];');
  const bail = !process.argv.includes('--no-bail');
  const restoreOptions = rewrite(OPTIONS_FILE, /module\.exports = \{bail: (?:true|false)\};/, 'module.exports = {bail: true};', `module.exports = {bail: ${bail}};`);
  if (only.length) console.log(`e2e-desktop: running only ${only.join(', ')}`);
  if (!bail) console.log('e2e-desktop: --no-bail - every suite runs even after one fails');

  const status = spawnSync('curl', ['-s', '--max-time', '5', `${URL}/status`], { encoding: 'utf8' }).stdout;
  if (!/packager-status:running/.test(status || '')) {
    restoreOnly(); restoreOptions();
    throw new Error(`no Metro at ${URL} - start it: pm2 start metro.pm2.config.js (in ok-edge)`);
  }

  const env = { ...process.env, OKEDGE_WEB_URL: URL, OKEDGE_CONSOLE: '1', OKEDGE_DRIVE: path.join(__dirname, 'e2e-desktop-drive.js') };
  const electron = spawn(process.execPath, [path.join(ROOT, 'electron', 'start.js')], { cwd: ROOT, env });
  const stop = () => {
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(electron.pid), '/T', '/F'], { stdio: 'ignore' });
    else electron.kill();
  };

  let log = '';
  let lastAt = Date.now();
  let lastLine = '(the suite has not printed anything)';
  let rest = '';
  const onData = (chunk) => {
    const lines = (rest + chunk).split(/\r?\n/);
    rest = lines.pop();
    for (const raw of lines) {
      const m = /^\[page \w+\] (.*)$/.exec(raw);
      const line = m ? m[1] : raw;
      if (!/\[Moniker\]|\[drive\]|\[okemu\]/.test(line)) continue;
      const shown = line.replace(/.*\[Moniker\]\s?/, '');
      console.log(`  ${shown}`);
      log += `${line}\n`;
      lastAt = Date.now();
      lastLine = shown;
    }
  };
  electron.stdout.on('data', onData);
  electron.stderr.on('data', onData);

  const started = Date.now();
  let outcome;
  try {
    outcome = await new Promise((resolve, reject) => {
      const tick = setInterval(() => {
        if (/TEST COMPLETE/.test(log)) { clearInterval(tick); setTimeout(resolve, 1500); return; }
        if (/\[drive\] FAILED/.test(log)) { clearInterval(tick); reject(new Error(lastLine)); return; }
        /* the soft key's process died: no suite can finish, so do not wait out the stall timer */
        if (/\[okemu\] the soft key's process ended/.test(log)) { clearInterval(tick); reject(new Error(`the soft key's process died: ${(log.match(/\[okemu\] (ACCESS VIOLATION[^\n]*|FATAL[^\n]*)/) || ['', 'see the log'])[1]}`)); return; }
        if (Date.now() - started > BUDGET_MS) { clearInterval(tick); reject(new Error(`the suite did not finish within ${BUDGET_MS / 1000}s. Last: ${lastLine}`)); return; }
        if (Date.now() - lastAt > STALL_MS) { clearInterval(tick); reject(new Error(`stuck after: ${lastLine}`)); }
      }, 500);
      electron.once('exit', (code) => { clearInterval(tick); if (!/TEST COMPLETE/.test(log)) reject(new Error(`Electron exited (${code}) before the suite finished. Last: ${lastLine}`)); });
    });
  } finally {
    stop();
    restoreOnly();
    restoreOptions();
  }

  const v = /Passed:\s*(\d+)\s*Failed:\s*(\d+)(?:\s*Skipped:\s*(\d+))?(?:\s*Bailed:\s*(\S+))?/.exec(log);
  if (!v) throw new Error('the suite finished but printed no verdict');
  const [passed, failed, skipped] = [Number(v[1]), Number(v[2]), v[3] === undefined ? 0 : Number(v[3])];
  console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'}  passed=${passed} failed=${failed}${skipped ? ` skipped=${skipped}` : ''}${v[4] ? ` (bailed after ${v[4]}; later suites did not run)` : ''}`);
  fs.writeFileSync(path.join(__dirname, '.last-e2e-desktop.json'), `${JSON.stringify({ passed, failed, skipped, bailedAfter: v[4], at: new Date().toISOString() })}\n`);
  return failed === 0 ? 0 : 1;
}

main().then((code) => process.exit(code), (e) => { console.error(`\ne2e-desktop: ${e.message}`); process.exit(2); });

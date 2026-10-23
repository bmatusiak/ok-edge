#!/usr/bin/env node
'use strict';
/*
 * ok-edge B4, TESTNET ONLY: run one `onlykey-js edge --test-mode ...` command against a DEBUG hard key on
 * this machine's USB and act as the person - answer the host's y/N with y, and press the key through its
 * debug console each time the CLI asks for a press. Automation is for test budgets only (Edge spec rule
 * 10), so this refuses any command without --test-mode. The live key is always driven by Brad by hand.
 *
 *   node edge-drive.js <onlykey-js cli/index.js> edge --test-mode budget --reason "..." --ssh 2 --ttl 30
 *
 * Environment: CONSOLE_LINE = path to release-3.1.0-test/tools/console-line.js (the key's debug console).
 * Output: the command's own lines, plus "drive: ..." for each answer and press.
 */
const { spawn, execFileSync } = require('child_process');
const path = require('path');

const [cli, ...args] = process.argv.slice(2);
if (!cli || !args.includes('--test-mode')) {
  process.stderr.write('edge-drive: testnet only - the command must carry --test-mode\n');
  process.exit(2);
}
const consoleLine = process.env.CONSOLE_LINE;
if (!consoleLine) { process.stderr.write('edge-drive: set CONSOLE_LINE to tools/console-line.js\n'); process.exit(2); }

/* a press on button 1 through the console - the same one press a person gives (soft and hard keys alike) */
function press() {
  execFileSync(process.execPath, [consoleLine, '1'], { cwd: path.dirname(consoleLine), stdio: 'ignore' });
}

const child = spawn(process.execPath, [cli, ...args], { stdio: ['pipe', 'pipe', 'pipe'] });
child.stdout.on('data', (d) => process.stdout.write(d));
let pending = '';
child.stderr.on('data', (d) => {
  process.stderr.write(d);
  pending += d.toString();
  /* the host's y/N (local-host.js): approve - this is the testnet */
  if (/\[y\/N\]\s*$/.test(pending)) {
    pending = '';
    process.stderr.write('drive: y\n');
    child.stdin.write('y\n');
  }
  /* a press asked for: "PRESS the key now" (a budget) or "press on the OnlyKey" (edge setup's certificate) */
  const lines = pending.split('\n');
  pending = lines.pop();
  for (const l of lines) {
    if (/PRESS the key now|press on the OnlyKey/.test(l)) {
      setTimeout(() => { process.stderr.write('drive: press\n'); try { press(); } catch (e) { process.stderr.write(`drive: press failed ${e.message}\n`); } }, 1500);
    }
  }
});
child.on('exit', (code) => process.exit(code === null ? 1 : code));

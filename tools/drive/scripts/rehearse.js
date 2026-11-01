'use strict';
/*
 * A REHEARSAL: a flow in Maestro's YAML (ok-edge/rehearsals/<name>.yaml), run by the drive on the app --app names
 * (tools/drive/maestro/runner.js says which commands, and what is ours under them).
 *   run.js rehearse <name|path.yaml> [--env KEY=VALUE ...] --app desktop|webapp|android
 * A flow is named plainly: <name>.<shell>.yaml runs in its place on that shell when there is one (runner.js forShell) -
 * also a flow only one platform has (bluetooth-on.android.yaml is `rehearse bluetooth-on` on the phone).
 */
const fs = require('fs');
const path = require('path');
const { createRunner, forShell } = require('../maestro/runner');

const REHEARSALS = path.resolve(__dirname, '..', '..', '..', 'rehearsals');
const SHELLS = ['android', 'desktop', 'webapp'];

/* the flows by their plain names, each with the platforms that have their own file: "login (android, webapp)" */
function listFlows() {
  const flows = new Map();
  for (const f of fs.readdirSync(REHEARSALS).filter((x) => x.endsWith('.yaml'))) {
    const base = f.replace(/\.yaml$/, '');
    const sh = SHELLS.find((s) => base.endsWith(`.${s}`));
    const name = sh ? base.slice(0, -(sh.length + 1)) : base;
    if (!flows.has(name)) flows.set(name, []);
    if (sh) flows.get(name).push(sh);
  }
  return [...flows].map(([n, shs]) => (shs.length ? `${n} (${shs.join(', ')})` : n)).join(', ');
}

module.exports = async (d, args) => {
  const env = {};
  const names = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--env') {
      const [k, ...v] = String(args[++i] || '').split('=');
      if (!k) throw new Error('--env KEY=VALUE');
      env[k] = v.join('=');
    } else names.push(args[i]);
  }
  if (!names.length) throw new Error(`run.js rehearse <name> - one of: ${listFlows()}`);
  for (const n of names) {
    const named = fs.existsSync(n) ? path.resolve(n) : path.join(REHEARSALS, n.endsWith('.yaml') ? n : `${n}.yaml`);
    /* this shell's own file, or the shared one (one of them must exist) */
    if (!fs.existsSync(forShell(named, d.app.shell))) throw new Error(`no rehearsal ${named} (nor its .${d.app.shell}.yaml) - one of: ${listFlows()}`);
    const runner = createRunner(d);
    await runner.runFile(named, env);
    d = runner.drive;
  }
};

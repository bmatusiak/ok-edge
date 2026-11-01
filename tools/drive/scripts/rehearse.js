'use strict';
/*
 * A REHEARSAL: a flow in Maestro's YAML (ok-edge/rehearsals/<name>.yaml), run by the drive on the app --app names
 * (tools/drive/maestro/runner.js says which commands, and what is ours under them).
 *   run.js rehearse <name|path.yaml> [--env KEY=VALUE ...] --app desktop|webapp|android
 */
const fs = require('fs');
const path = require('path');
const { createRunner } = require('../maestro/runner');

const REHEARSALS = path.resolve(__dirname, '..', '..', '..', 'rehearsals');

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
  if (!names.length) throw new Error(`run.js rehearse <name> - one of: ${fs.readdirSync(REHEARSALS).filter((f) => f.endsWith('.yaml')).map((f) => f.replace(/\.yaml$/, '')).join(', ')}`);
  for (const n of names) {
    const file = fs.existsSync(n) ? path.resolve(n) : path.join(REHEARSALS, n.endsWith('.yaml') ? n : `${n}.yaml`);
    if (!fs.existsSync(file)) throw new Error(`no rehearsal ${file}`);
    const runner = createRunner(d);
    await runner.runFile(file, env);
    d = runner.drive;
  }
};

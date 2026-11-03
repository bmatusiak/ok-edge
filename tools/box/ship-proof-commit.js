#!/usr/bin/env node
'use strict';
/*
 * ONE UNSIGNED COMMIT FOR THE SHIP REHEARSAL (rehearsals/ship.yaml): `edge control ship --max 1` needs one waiting in
 * the box's scratch repo, or it says "nothing to do" and the budget sheet never comes (2026-11-03: a re-run after a
 * pass found the repo already shipped). Only this repo - its remote is the box's own sshd, never GitHub.
 *
 * N OF THEM FOR A BATCH (2026-11-03): a ship of several uses is what left the desktop asking the key ~2,000 times after
 * it - the rehearsal that proves the app asks nothing after a ship ships more than one.
 *
 *   node tools/box/ship-proof-commit.js [N]      N commits, 1 by default
 */
const path = require('path');
const os = require('os');
const fs = require('fs');
const { execFileSync } = require('child_process');

const repo = path.join(os.homedir(), 'scratch/ship-proof');
const git = (...a) => execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8' }).trim();
const n = Math.max(1, parseInt(process.argv[2] || '1', 10) || 1);
for (let i = 1; i <= n; i++) {
  const at = new Date().toISOString();
  fs.appendFileSync(path.join(repo, 'proof.txt'), `${at} ${i}/${n}\n`);
  git('add', 'proof.txt');
  git('-c', 'commit.gpgsign=false', 'commit', '-q', '-m', `ship proof ${at} (${i} of ${n})`);
}
console.log(`committed ${n} up to ${git('rev-parse', '--short', 'HEAD')} in ${repo} (unsigned, ${git('rev-list', '--count', '@{u}..HEAD')} after its upstream)`);

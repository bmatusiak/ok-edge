#!/usr/bin/env node
'use strict';
/*
 * THE LIB'S UNPUSHED WORK INTO OK-EDGE'S COPY, FOR DEVELOPMENT: ok-edge pins the lib at a pushed commit
 * (package.json github:...#sha), and a lib change that is not pushed yet (nothing is pushed until it works - Brad's rule)
 * reaches node_modules/node-onlykey-lib only by a copy. This copies the named files from the lib checkout beside
 * ok-edge, and merges the lib's package.json `exports` (a new entry point is not importable without it) - nothing else
 * of the installed package.json changes. The re-pin after the push replaces all of it.
 *
 *   node tools/lib-into-edge.js cli/ble-link.js src/transport/ble-socket.js ...
 */
const fs = require('fs');
const path = require('path');

const EDGE = path.resolve(__dirname, '..');
const LIB = process.env.OKEDGE_LIB_DIR || path.resolve(EDGE, '..', 'node-onlykey-lib');
const INTO = path.join(EDGE, 'node_modules', 'node-onlykey-lib');

const files = process.argv.slice(2);
if (!files.length) { console.error('usage: node tools/lib-into-edge.js <lib-relative file> ...'); process.exit(2); }
if (!fs.existsSync(INTO)) { console.error(`no ${INTO} - npm install in ok-edge first`); process.exit(1); }
for (const f of files) {
  const from = path.join(LIB, f);
  if (!fs.existsSync(from)) { console.error(`no ${from}`); process.exit(1); }
  fs.mkdirSync(path.dirname(path.join(INTO, f)), { recursive: true });
  fs.copyFileSync(from, path.join(INTO, f));
  console.log(`copied ${f}`);
}
const libPkg = JSON.parse(fs.readFileSync(path.join(LIB, 'package.json'), 'utf8'));
const pkgFile = path.join(INTO, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
const added = Object.keys(libPkg.exports || {}).filter((k) => !(pkg.exports || {})[k]);
if (added.length) {
  pkg.exports = { ...pkg.exports, ...Object.fromEntries(added.map((k) => [k, libPkg.exports[k]])) };
  fs.writeFileSync(pkgFile, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log(`exports added: ${added.join(', ')}`);
}

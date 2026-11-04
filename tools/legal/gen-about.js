'use strict';
/*
 * WHAT THIS APP IS AND WHAT IT USES, FOR ITS LOG IN PAGE AND ITS LEGAL PAGE (Brad, 2026-11-04: "App version and
 * short-hash, lib version and hash - stuff about the app and what it uses"; "a legal button that opens a legal page that
 * shows licences, contributors and stuff"). Written to src/generated/about.json from what is on disk, never typed in:
 *   app        ok-edge's version, its commit (git), its license (package.json) and NOTICE
 *   library    node-onlykey-lib's version and the commit package.json pins
 *   contributors  CONTRIBUTORS as it is (people added when they ask to be listed)
 *   firmware   the OnlyKey firmware's license (CryptoTrust) and its libraries' licenses - copied verbatim from the
 *              v3.1.0 sources into tools/legal/: the license requires its acknowledgment and where the source is
 *   packages   every package the app depends on (package.json dependencies, followed through each package's own),
 *              with its version and license - dev tools are not in the app, so not listed
 *
 * metro.config.js runs it, so every bundle (the desktop, the web app, the phone, a dev server) has it; the file is
 * written only when it changed, so Metro does not rebuild for nothing. `node tools/legal/gen-about.js` runs it alone.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const EDGE = path.resolve(__dirname, '..', '..');
const OUT = path.join(EDGE, 'src', 'generated', 'about.json');
const read = (f) => fs.readFileSync(path.join(EDGE, f), 'utf8');
const json = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

/* the commit this tree is at, short; '' outside a git checkout (an export from a tarball) */
function commit() {
  if (process.env.EXPO_PUBLIC_APP_COMMIT) return String(process.env.EXPO_PUBLIC_APP_COMMIT).slice(0, 7);
  try { return execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], { cwd: EDGE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; }
}

/* a package's folder, found as Node finds it: from the folder that needs it, up through each node_modules */
function folderOf(name, from) {
  for (let dir = from; ; dir = path.dirname(dir)) {
    const f = path.join(dir, 'node_modules', name, 'package.json');
    if (fs.existsSync(f)) return path.dirname(f);
    if (dir === path.dirname(dir) || dir === path.dirname(EDGE)) return null;
  }
}
const licenseOf = (p) => String(p.license || (Array.isArray(p.licenses) ? p.licenses.map((l) => l.type || l).join(' OR ') : '') || 'not stated');

function packages(pkg) {
  const seen = new Map();
  const queue = Object.keys(pkg.dependencies || {}).map((name) => [name, EDGE]);
  while (queue.length) {
    const [name, from] = queue.shift();
    const dir = folderOf(name, from);
    if (!dir || seen.has(dir)) continue;
    const p = json(path.join(dir, 'package.json'));
    seen.set(dir, { name: p.name || name, version: String(p.version || ''), license: licenseOf(p) });
    for (const d of Object.keys({ ...(p.dependencies || {}), ...(p.optionalDependencies || {}) })) queue.push([d, dir]);
  }
  /* one row per name and version, sorted */
  const rows = new Map([...seen.values()].map((r) => [`${r.name}@${r.version}`, r]));
  return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
}

function about() {
  const pkg = json(path.join(EDGE, 'package.json'));
  const libDir = path.join(EDGE, 'node_modules', 'node-onlykey-lib');
  const lib = fs.existsSync(path.join(libDir, 'package.json')) ? json(path.join(libDir, 'package.json')) : {};
  const pin = (/#([0-9a-f]{7,40})$/.exec(String(pkg.dependencies?.['node-onlykey-lib'] ?? '')) || [])[1] || '';
  return {
    app: { name: 'OnlyKey Edge', version: String(pkg.version), commit: commit(), license: pkg.license || 'not stated', notice: read('NOTICE').trim() },
    library: { name: 'node-onlykey-lib', version: String(lib.version || 'unknown'), commit: pin.slice(0, 7), license: licenseOf(lib) },
    contributors: read('CONTRIBUTORS').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#')),
    source: [
      { what: 'OnlyKey Edge', where: 'https://github.com/bmatusiak/ok-edge' },
      { what: 'node-onlykey-lib', where: 'https://github.com/bmatusiak/node-onlykey-lib' },
      { what: 'The soft key (the OnlyKey firmware run in the app) and its patches', where: 'https://github.com/bm-ok/node-onlykey-emulator' },
      { what: 'The OnlyKey firmware', where: 'https://github.com/trustcrypto/OnlyKey-Firmware' },
      { what: 'The OnlyKey firmware libraries', where: 'https://github.com/trustcrypto/libraries' },
    ],
    firmware: {
      acknowledgment: 'This product includes software developed by CryptoTrust LLC. for the OnlyKey Project (https://crp.to/ok)',
      license: read('tools/legal/onlykey-firmware-license.txt').trim(),
      libraries: read('tools/legal/onlykey-firmware-libraries-licenses.md').trim(),
    },
    apache: read('LICENSE').trim(),
    packages: packages(pkg),
  };
}

function write() {
  const text = `${JSON.stringify(about(), null, 1)}\n`;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const was = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (was !== text) fs.writeFileSync(OUT, text);
  return OUT;
}

module.exports = write;
if (require.main === module) {
  const out = write();
  const a = json(out);
  console.log(`${path.relative(EDGE, out)}: ${a.app.name} ${a.app.version} ${a.app.commit}, ${a.library.name} ${a.library.version} ${a.library.commit}, ${a.packages.length} packages, ${a.contributors.length} contributor(s)`);
}

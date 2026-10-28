#!/usr/bin/env node
'use strict';
/*
 * THE DESKTOP APP AS A DOWNLOAD (Brad, 2026-10-28: "desktop package = go, linux and windows separated packages").
 *
 *   node tools/release/desktop-package.js --platform win|linux --emulator <node-onlykey-emulator/emulator> --out <dir>
 *        --repo <owner/name> --tag <tag> --version <v> --version-code <n> --commit <sha>
 *   node tools/release/desktop-package.js merge <desktop-*.json>... --out <docs/desktop/manifest.json>
 *
 * One package per system - a .zip for Windows, a .tar.gz for Linux, x64 - unpacked and run from where it lands (no
 * installer: nothing is written outside its folder but the app's own data). What is in it:
 *
 *   resources/app/                    electron/ and the RELEASE web export (dist/web, built before this runs), with a
 *                                     package.json of ITS OWN: only what the main process loads - node-onlykey-lib at
 *                                     ok-edge's pin, node-hid (a USB key), the noble fork and dbus-next (Bluetooth),
 *                                     every one prebuilt. Not ok-edge's package.json: that carries Expo and React
 *                                     Native, which the web export already holds compiled.
 *   resources/node-onlykey-emulator/  the soft key: the emulator's module, built from the recorded sources with the
 *                                     phone's plugins, where electron/okemu-host.js looks for it beside the app
 *   resources/node/                   the plain Node the soft key and the sync service run on (electron/node-binary.js)
 *                                     - the very Node the soft key's native module was built with, so its ABI matches
 *                                     and the computer needs no Node of its own
 *
 * asar is off: the soft key's host is plain Node, which cannot read inside an asar archive.
 *
 * Before the manifest is written the package is checked as it will run: its Node loads the soft key's module, and the
 * lib's CLI answers --help from the packaged folder. And what a release must not carry: the soft key's DEBUG console
 * (it prints key bytes), the testing screen in the web export.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const fail = (msg) => { console.error(`desktop-package: ${msg}`); process.exit(1); };
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

if (args[0] === 'merge') {
  const out = opt('--out');
  const files = args.slice(1).filter((a, i, all) => a !== '--out' && all[i - 1] !== '--out');
  if (!out || !files.length) fail('usage: merge <desktop-*.json>... --out <file>');
  const packages = files.map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ packages }, null, 2) + '\n');
  console.log(`desktop manifest: ${packages.map((p) => p.file).join(', ')}`);
  process.exit(0);
}

const PLATFORM = opt('--platform');
const EMU = opt('--emulator') && path.resolve(opt('--emulator'));
const OUT = opt('--out') && path.resolve(opt('--out'));
const [REPO, TAG, VERSION, CODE, COMMIT] = ['--repo', '--tag', '--version', '--version-code', '--commit'].map(opt);
if (!['win', 'linux'].includes(PLATFORM) || !EMU || !OUT || !REPO || !TAG || !VERSION || !CODE || !COMMIT) {
  fail('usage: --platform win|linux --emulator <dir> --out <dir> --repo <o/r> --tag <t> --version <v> --version-code <n> --commit <sha>');
}
const OS_NAME = PLATFORM === 'win' ? 'windows' : 'linux';
const EXT = PLATFORM === 'win' ? 'zip' : 'tar.gz';
const FILE = `onlykey-edge-desktop-${VERSION}-${CODE}-${OS_NAME}-x64.${EXT}`;
const WEB = path.join(ROOT, 'dist', 'web');

/* ---------------------------------------------------------------- what a release must not carry */
if (!fs.existsSync(path.join(WEB, 'index.html'))) fail(`no web export at ${WEB} - npm run build:web first`);
const bundles = fs.readdirSync(path.join(WEB, '_expo', 'static', 'js', 'web')).filter((f) => f.endsWith('.js'));
/* a development export (__DEV__ on: testing mode, Login Bypass) names its bundle by the md5 of nothing */
if (bundles.some((f) => f.includes('d41d8cd98f00b204e9800998ecf8427e'))) fail('the web export is a development export - npm run build:web makes the release one');
if (bundles.some((f) => fs.readFileSync(path.join(WEB, '_expo', 'static', 'js', 'web', f), 'utf8').includes('Soft Key firmware'))) {
  fail('the testing screen is in the web export - a release export (npm run build:web) leaves it out');
}
const ADDON = path.join(EMU, 'build', 'Release', 'onlykey_emulator.node');
if (!fs.existsSync(ADDON)) fail(`the soft key is not built: no ${ADDON}`);
/* every staged tree's onlykey.h (.stage, and any .stage-<name> beside it) */
for (const d of fs.readdirSync(EMU).filter((d) => d.startsWith('.stage'))) {
  const h = path.join(EMU, d, 'libraries', 'onlykey', 'onlykey.h');
  if (fs.existsSync(h) && /^#define DEBUG\s/m.test(fs.readFileSync(h, 'utf8'))) fail(`DEBUG on in ${h}`);
}
const built = JSON.parse(fs.readFileSync(path.join(EMU, '.stage', 'build.json'), 'utf8'));
/* the web export carries the soft key's build record (src/generated/firmware.json, written by the emulator's stage with
   OKEMU_APP_OUT): it must be THIS soft key's - its plugins turn the app's features on - and the debugging lock must be
   on (a record from an OKRN_DEBUG_LOCK=off build puts the red TEST BUILD banner in the app) */
const record = path.join(ROOT, 'src', 'generated', 'firmware.json');
if (!fs.existsSync(record)) fail('no src/generated/firmware.json - build the soft key with OKEMU_APP_OUT=<ok-edge>/src/generated');
const staged = JSON.parse(fs.readFileSync(record, 'utf8'));
if (staged.debugLock === false) fail('the debugging lock is off in src/generated/firmware.json (OKRN_DEBUG_LOCK=off)');
if (JSON.stringify(staged.plugins || []) !== JSON.stringify(built.plugins || [])) {
  fail(`the web export's soft key record (${staged.plugins}) is not the soft key packaged (${built.plugins})`);
}
if (fs.statSync(record).mtimeMs > fs.statSync(path.join(WEB, 'index.html')).mtimeMs) fail('the web export is older than the soft key record - npm run build:web again');

/* ---------------------------------------------------------------- the app folder */
const WORK = path.join(ROOT, 'dist', `desktop-${OS_NAME}`);
const APP = path.join(WORK, 'app');
const EXTRA = path.join(WORK, 'extra');
fs.rmSync(WORK, { recursive: true, force: true });
fs.mkdirSync(APP, { recursive: true });
fs.cpSync(path.join(ROOT, 'electron'), path.join(APP, 'electron'), { recursive: true });
fs.cpSync(WEB, path.join(APP, 'dist', 'web'), { recursive: true });

const okEdge = require(path.join(ROOT, 'package.json'));
const lib = require(path.join(ROOT, 'node_modules', 'node-onlykey-lib', 'package.json'));
fs.writeFileSync(path.join(APP, 'package.json'), JSON.stringify({
  name: 'ok-edge',
  productName: 'ok-edge',
  version: VERSION,
  description: 'OnlyKey Edge - the desktop app',
  main: 'electron/main.js',
  private: true,
  /* the noble fork is not optional: npm drops everything that is optional only through a failed module (onlykey-js's
     README), and Windows' Bluetooth is that fork */
  dependencies: {
    'node-onlykey-lib': okEdge.dependencies['node-onlykey-lib'],
    '@stoprocent/noble': lib.peerDependencies['@stoprocent/noble'],
  },
  optionalDependencies: {
    'node-hid': lib.peerDependencies['node-hid'],
    'dbus-next': lib.peerDependencies['dbus-next'],
  },
}, null, 2) + '\n');
const npm = spawnSync('npm', ['install', '--omit=dev', '--no-audit', '--no-fund', '--no-package-lock'],
  { cwd: APP, stdio: 'inherit', shell: process.platform === 'win32' });
if (npm.status !== 0) fail('npm install in the app folder failed');

/* ---------------------------------------------------------------- the soft key and its Node */
const SOFTKEY = path.join(EXTRA, 'node-onlykey-emulator', 'emulator');
fs.mkdirSync(path.join(SOFTKEY, 'build', 'Release'), { recursive: true });
fs.mkdirSync(path.join(SOFTKEY, '.stage'), { recursive: true });
for (const f of ['index.js', 'package.json', 'lib']) fs.cpSync(path.join(EMU, f), path.join(SOFTKEY, f), { recursive: true });
fs.copyFileSync(ADDON, path.join(SOFTKEY, 'build', 'Release', 'onlykey_emulator.node'));
fs.copyFileSync(path.join(EMU, '.stage', 'build.json'), path.join(SOFTKEY, '.stage', 'build.json'));
/* index.js names a plugin build's storage through the lib's firmware-plugins.js (plain fs and path) */
fs.cpSync(path.join(EMU, 'node_modules', 'node-onlykey-lib'), path.join(SOFTKEY, 'node_modules', 'node-onlykey-lib'), {
  recursive: true,
  filter: (src) => !src.includes(`${path.sep}node_modules${path.sep}node-onlykey-lib${path.sep}node_modules`),
});
fs.mkdirSync(path.join(EXTRA, 'node'), { recursive: true });
fs.copyFileSync(process.execPath, path.join(EXTRA, 'node', PLATFORM === 'win' ? 'node.exe' : 'node'));

/* ---------------------------------------------------------------- package */
(async () => {
  const { build, Platform } = require('electron-builder');
  const electronVersion = require(path.join(ROOT, 'node_modules', 'electron', 'package.json')).version;
  await build({
    targets: (PLATFORM === 'win' ? Platform.WINDOWS : Platform.LINUX).createTarget(),
    projectDir: ROOT,
    config: {
      appId: 'com.okedge.desktop',
      productName: 'ok-edge',
      electronVersion,
      directories: { app: APP, output: path.join(WORK, 'out') },
      files: ['**/*'],
      asar: false,
      /* the app's node_modules exactly as npm installed them: electron-builder copies only the folders of its own
         dependency walk, and the lib vendors its crypto as src/vendor/node_modules, which no walk lists (the packaged
         CLI then failed on @noble/hashes) */
      afterPack: async (ctx) => {
        const dest = path.join(ctx.appOutDir, 'resources', 'app', 'node_modules');
        fs.rmSync(dest, { recursive: true, force: true });
        fs.cpSync(path.join(APP, 'node_modules'), dest, { recursive: true });
      },
      npmRebuild: false,
      extraResources: [
        { from: path.join(EXTRA, 'node-onlykey-emulator'), to: 'node-onlykey-emulator' },
        { from: path.join(EXTRA, 'node'), to: 'node' },
      ],
      artifactName: FILE.replace(new RegExp(`\\.${EXT.replace('.', '\\.')}$`), '.${ext}'),
      win: { target: [{ target: 'zip', arch: ['x64'] }] },
      linux: { target: [{ target: 'tar.gz', arch: ['x64'] }], executableName: 'ok-edge', category: 'Utility' },
      publish: null,
    },
  });

  /* ---------------------------------------------------------------- the package as it will run */
  const unpacked = path.join(WORK, 'out', PLATFORM === 'win' ? 'win-unpacked' : 'linux-unpacked');
  const res = path.join(unpacked, 'resources');
  const node = path.join(res, 'node', PLATFORM === 'win' ? 'node.exe' : 'node');
  const run = (what, argv) => {
    const r = spawnSync(node, argv, { encoding: 'utf8', cwd: os.tmpdir() });
    if (r.status !== 0) fail(`${what}: exit ${r.status}\n${r.stdout}\n${r.stderr}`);
    return r.stdout;
  };
  run('the soft key module does not load in the packaged Node',
    ['-e', `const e = require(${JSON.stringify(path.join(res, 'node-onlykey-emulator', 'emulator'))}); if (typeof e.on !== 'function') process.exit(2);`]);
  const help = run('the packaged CLI does not answer', [path.join(res, 'app', 'node_modules', 'node-onlykey-lib', 'cli', 'index.js'), '--help']);
  if (!/onlykey-js/.test(help)) fail('the packaged CLI printed no usage');

  const pkg = path.join(WORK, 'out', FILE);
  if (!fs.existsSync(pkg)) fail(`electron-builder made no ${FILE}`);
  fs.mkdirSync(OUT, { recursive: true });
  fs.copyFileSync(pkg, path.join(OUT, FILE));
  const manifest = {
    os: OS_NAME,
    arch: 'x64',
    file: FILE,
    url: `https://github.com/${REPO}/releases/download/${TAG}/${FILE}`,
    sha256: sha256(pkg),
    size: fs.statSync(pkg).size,
    version: VERSION,
    versionCode: Number(CODE),
    commit: COMMIT.slice(0, 7),
    builtAt: new Date().toISOString(),
    softKey: { version: built.version, plugins: built.plugins || [] },
  };
  fs.writeFileSync(path.join(OUT, `desktop-${OS_NAME}.json`), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`desktop-package: ${FILE} (${(manifest.size / 1048576).toFixed(1)} MB), sha256 ${manifest.sha256}`);
})().catch((e) => fail(e.stack || e.message));

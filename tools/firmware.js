#!/usr/bin/env node
'use strict';
/*
 * THE DEVELOPER-KEY FIRMWARE THE WEB APP OFFERS (firmware/), BUILT BEFORE IT IS PUSHED (Brad, 2026-10-27: "we build
 * it,, we just need to make sure we build it before pushing to cloudflare").
 *
 * Cloudflare does not build firmware: mcp-server/build-webapp.js only copies firmware/ into the site. So the hex is
 * built here (on the box, the OnlyKey Docker toolchain), committed, and a push to main or cloudflare (both deploy)
 * is refused while the committed hex is not the build of the sources it claims - the pre-push hook runs `check`.
 *
 *   node tools/firmware.js build [--force]       build on the box, post the hex + manifest into firmware/ (tested: false);
 *                                                skipped when firmware/ already holds this build hash
 *   node tools/firmware.js tested "<what ran>"   this exact hex passed on a hard key (the page then drops its warning)
 *   node tools/firmware.js check [<rev>]         firmware/ (or as committed at <rev>) matches the sources; exit 1 if not
 *   node tools/firmware.js install-hook          the pre-push hook (tools/hooks/pre-push) into this clone
 *
 * WHAT "THE SOURCES" ARE: the emulator checkout beside this repo (../node-onlykey-emulator), at its committed HEAD -
 * the release pins (scripts/versions/v3.1.0.js), the fixes staged on them (fixes-3.1.0.js names, from the patch files),
 * the plugins' code, and the node-onlykey-lib that applies the plugins (its pin in the emulator's package.json). Their
 * git tree hashes are the manifest's `sources`; any change to any of them makes the posted hex stale, so a plugin edit
 * cannot reach the site with yesterday's firmware beside it.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'firmware');
const EMU_REPO = path.resolve(ROOT, '..', 'node-onlykey-emulator');
const EMU = path.join(EMU_REPO, 'emulator');
/* the web app's firmware: Edge and the browser's way in. Never a softKeyOnly plugin (build-hardkey.sh refuses them) */
const PLUGINS = ['edge', 'ctap_bridge'];
/* what the hex is built from, as paths in the emulator repo: a change in any of them is a new build */
const SOURCE_PATHS = [
  'emulator/scripts/versions/v3.1.0.js',
  'emulator/scripts/versions/fixes-3.1.0.js',
  'emulator/scripts/versions/patches-3.1.0',
  'emulator/package.json',
  ...PLUGINS.map((p) => `emulator/plugins/${p}`),
];
const BOX = 'bmatusiak@192.168.51.113';
const BOX_EMU = '~/project/onlykey/node-onlykey-emulator';
const TOOLCHAIN = 'arduino-1.6.5-r5-teensy_127, the OnlyKey Docker build (emulator/plugins/edge/tools/build-hardkey.sh)';

const git = (cwd, ...a) => execFileSync('git', ['-C', cwd, ...a], { encoding: 'utf8' }).trim();
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const fail = (msg) => { console.error(`firmware: ${msg}`); process.exit(1); };

/* what the posted firmware must be, read from the emulator checkout's committed HEAD (never its working files) */
function expected() {
  if (!fs.existsSync(path.join(EMU_REPO, '.git'))) fail(`no emulator checkout at ${EMU_REPO} - cannot tell what the firmware must be`);
  const dirty = git(EMU_REPO, 'status', '--porcelain', '--', ...SOURCE_PATHS);
  if (dirty) fail(`the emulator has uncommitted changes in the firmware's sources - commit them first:\n${dirty}`);
  const version = require(path.join(EMU, 'scripts/versions/v3.1.0.js'));
  const fixes = require(path.join(EMU, 'scripts/versions/fixes-3.1.0.js'));
  const site = (fs.readFileSync(path.join(EMU, 'plugins/ctap_bridge/src/okplugin_ctap_bridge.cpp'), 'utf8')
    .match(/#define CB_SITE_DEFAULT "([^"]+)"/) || [])[1];
  const want = {
    version: version.version,
    firmware: version.pins['OnlyKey-Firmware'],
    libraries: version.pins.libraries,
    fixes: fixes.names,
    plugins: PLUGINS,
    site,
    sources: Object.fromEntries(SOURCE_PATHS.map((p) => [p, sourceHash(p).slice(0, 12)])),
  };
  /*
   * ONE HASH FOR EVERYTHING THE HEX IS BUILT FROM (Brad, 2026-10-27: "a patch hash so we dont need to keep rebuilding
   * it if its already up to date"): the same inputs give the same hash, so `build` skips a build the posted hex
   * already is, and any change to an input is a new hash. The full tree hashes go in, not the 12-char ones shown.
   */
  want.buildHash = sha256(JSON.stringify({
    ...want,
    sources: SOURCE_PATHS.map((p) => [p, sourceHash(p)]),
  })).slice(0, 16);
  return want;
}

/*
 * ONLY WHAT IS COMPILED: a plugin's tests/ and its *.md never reach the firmware, so a kit-test fix or an AUDIT note
 * is not a new build (2026-10-27: fixing the edge kit test moved the hash of a hex already tested on key 2). The hash
 * of a path is the hash of its committed file list minus those - blob hashes, so any compiled byte still counts.
 */
function sourceHash(p) {
  const files = git(EMU_REPO, 'ls-tree', '-r', 'HEAD', '--', p).split('\n')
    .filter((l) => l && !/\/tests\//.test(l) && !/\.md$/.test(l));
  return sha256(files.join('\n'));
}

/* firmware/ as committed at `rev`, or as on disk */
function posted(rev) {
  const read = (f) => (rev
    ? execFileSync('git', ['-C', ROOT, 'show', `${rev}:firmware/${f}`], { maxBuffer: 64 << 20 })
    : fs.readFileSync(path.join(DIR, f)));
  const files = rev
    ? git(ROOT, 'ls-tree', '--name-only', `${rev}:firmware`).split('\n')
    : fs.readdirSync(DIR);
  return { manifest: JSON.parse(read('manifest.json').toString('utf8')), hexes: files.filter((f) => f.endsWith('.hex')), read };
}

/* every difference between what is posted and what the sources say, in words */
function differences(rev) {
  const want = expected();
  const { manifest: m, hexes, read } = posted(rev);
  const out = [];
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  for (const k of ['version', 'firmware', 'libraries', 'fixes', 'plugins', 'site']) {
    if (!same(m[k], want[k])) out.push(`${k}: posted ${JSON.stringify(m[k])}, the sources say ${JSON.stringify(want[k])}`);
  }
  for (const [p, h] of Object.entries(want.sources)) {
    const had = (m.sources || {})[p];
    if (had !== h) out.push(`${p}: built from ${had || '(not recorded)'}, now ${h}`);
  }
  if (m.buildHash !== want.buildHash) out.push(`build hash: posted ${m.buildHash || '(none)'}, the sources make ${want.buildHash}`);
  if (hexes.length !== 1 || hexes[0] !== m.file) out.push(`firmware/ must hold exactly the manifest's hex (${m.file}); it holds ${hexes.join(', ') || 'none'}`);
  else {
    const hex = read(m.file);
    if (sha256(hex) !== m.sha256) out.push(`${m.file}: its sha256 is not the manifest's`);
    else if (!carriesStamp(hex.toString('latin1'), stampOf(want.buildHash))) out.push(`${m.file}: does not carry build stamp ${stampOf(want.buildHash)}`);
  }
  return out;
}

/*
 * THE BUILD HASH IS IN THE HEX ITSELF (Brad, 2026-10-27: "instead of having it do a build time, we feed it a build hash
 * from all the pins involved"): build-hardkey.sh links its first 8 hex digits where the toolchain puts the build time
 * (__rtc_localtime, 4 bytes little-endian), so the same sources build the same bytes and a hex says what it was built
 * from without its manifest.
 */
const stampOf = (buildHash) => buildHash.slice(0, 8);
function carriesStamp(hexText, stamp) {
  const data = [];
  for (const line of hexText.split(/\r?\n/)) {
    if (line.startsWith(':') && line.slice(7, 9) === '00') data.push(Buffer.from(line.slice(9, 9 + 2 * parseInt(line.slice(1, 3), 16)), 'hex'));
  }
  return Buffer.concat(data).includes(Buffer.from(stamp, 'hex').reverse());
}

function check(rev) {
  const out = differences(rev);
  if (!out.length) {
    const m = posted(rev).manifest;
    console.log(`firmware: ${m.file} is the build of the current sources${m.tested ? ` (tested: ${m.testedOn})` : ' (not yet tested on a hard key)'}`);
    return;
  }
  fail(`firmware/${rev ? ` at ${rev.slice(0, 7)}` : ''} is not the build of the current sources:\n  ${out.join('\n  ')}\n` +
    'build and post it first: node tools/firmware.js build (then commit firmware/)');
}

function build(force) {
  const want = expected();
  if (!force && fs.existsSync(path.join(DIR, 'manifest.json')) && !differences().length) {
    console.log(`firmware: up to date - firmware/ already holds build ${want.buildHash}; nothing to build (--force builds anyway)`);
    return;
  }
  /* the box builds from ITS clone: the same committed sources, or the hex would claim what it is not built from */
  const box = execFileSync('ssh', [BOX, `cd ${BOX_EMU} && git status --porcelain -- ${SOURCE_PATHS.join(' ')} && ` +
    SOURCE_PATHS.map((p) => `git rev-parse HEAD:${p}`).join(' && ')], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })
    .trim().split('\n');
  /* the same trees, whole (tests included): the box's files are exactly this checkout's */
  const here = SOURCE_PATHS.map((p) => git(EMU_REPO, 'rev-parse', `HEAD:${p}`));
  if (box.length !== SOURCE_PATHS.length || !here.every((h, i) => box[i] === h)) {
    fail('the box\'s emulator clone is not at these sources (or has changes in them) - run tools/box/sync-to-box.sh emu first');
  }
  console.log(`firmware: building on the box: ${want.version} @ ${want.firmware}/${want.libraries}, fixes ${want.fixes.join(' ')}, plugins ${PLUGINS.join(',')}`);
  const r = spawnSync('ssh', [BOX, `source ~/.nvm/nvm.sh >/dev/null; cd ${BOX_EMU}/emulator && ` +
    `FW_PIN=${want.firmware} LIB_PIN=${want.libraries} PLUGINS=${PLUGINS.join(',')} BUILD_STAMP=${stampOf(want.buildHash)} ` +
    'bash plugins/edge/tools/build-hardkey.sh'],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  process.stdout.write(r.stdout || '');
  const image = ((r.stdout || '').match(/== \S+ 6\. (\S+\.hex)/) || [])[1];
  if (r.status !== 0 || !image) fail('the box build did not finish (see above)');
  const file = path.basename(image);
  const tmp = path.join(DIR, `${file}.part`);
  execFileSync('scp', ['-q', `${BOX}:${image}`, tmp], { stdio: 'inherit' });
  for (const f of fs.readdirSync(DIR)) if (f.endsWith('.hex')) fs.rmSync(path.join(DIR, f));
  fs.renameSync(tmp, path.join(DIR, file));
  const manifest = {
    file,
    version: want.version,
    firmware: want.firmware,
    libraries: want.libraries,
    fixes: want.fixes,
    plugins: want.plugins,
    buildHash: want.buildHash,
    sources: want.sources,
    sourcesFrom: `node-onlykey-emulator ${git(EMU_REPO, 'rev-parse', '--short', 'HEAD')}`,
    debug: true,
    site: want.site,
    toolchain: TOOLCHAIN,
    built: new Date().toISOString().slice(0, 10),
    tested: false,
    sha256: sha256(fs.readFileSync(path.join(DIR, file))),
  };
  fs.writeFileSync(path.join(DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`firmware: posted firmware/${file} (sha256 ${manifest.sha256.slice(0, 12)}), not yet tested - commit firmware/`);
}

function tested(what) {
  if (!what) fail('say what ran on which key, e.g. tested "key 2: kit 178/0"');
  const out = differences();
  if (out.length) fail(`firmware/ is not the build of the current sources - nothing to mark:\n  ${out.join('\n  ')}`);
  const m = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));
  m.tested = true;
  m.testedOn = `${new Date().toISOString().slice(0, 10)} ${what}`;
  fs.writeFileSync(path.join(DIR, 'manifest.json'), `${JSON.stringify(m, null, 2)}\n`);
  console.log(`firmware: ${m.file} marked tested (${m.testedOn})`);
}

function installHook() {
  const hooks = path.resolve(ROOT, git(ROOT, 'rev-parse', '--git-path', 'hooks'));
  fs.mkdirSync(hooks, { recursive: true });
  fs.copyFileSync(path.join(__dirname, 'hooks', 'pre-push'), path.join(hooks, 'pre-push'));
  fs.chmodSync(path.join(hooks, 'pre-push'), 0o755);
  console.log(`firmware: pre-push hook installed in ${hooks}`);
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'build') build(arg === '--force');
else if (cmd === 'tested') tested(arg);
else if (cmd === 'check') check(arg);
else if (cmd === 'install-hook') installHook();
else fail('usage: node tools/firmware.js build | tested "<what ran>" | check [<rev>] | install-hook');

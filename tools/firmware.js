#!/usr/bin/env node
'use strict';
/*
 * THE DEVELOPER-KEY FIRMWARE THE WEB APP OFFERS (Brad, 2026-10-27: "we build it, we just need to make sure we build it
 * before pushing to cloudflare"; then "the first thing the workflow needs to build is the firmware, then the apk").
 *
 * NO BUILDS ON MAIN (Brad, 2026-10-27: "this will keep our main from having builds"): main keeps firmware/manifest.json
 * only - THE RECORD of the build the sources make (its build hash, the emulator commit it is built from) and whether that
 * build has run on a hard key. The hex itself is built by the release workflow (.github/workflows/release.yml, `ci-build`)
 * and published on the cloudflare branch and in the GitHub release; a hex built here for a developer key stays in
 * firmware/ untracked (.gitignore).
 *
 *   node tools/firmware.js build [--force]       build on the box (for a key on the bench): the hex into firmware/
 *                                                (untracked) + the record (tested: false); skipped when up to date
 *   node tools/firmware.js tested "<what ran>"   the recorded build passed on a hard key: the record says so, and every
 *                                                build of the same hash carries it (the page then drops its warning)
 *   node tools/firmware.js check [<rev>]         the record (as committed at <rev>) is the build of the current sources
 *   node tools/firmware.js prod-only <dir>       a ci-build firmware/ folder down to the prod hex (the APK, the web app)
 *   node tools/firmware.js ci-build --out <dir> --src <dir> --kit <dir>
 *                                                the workflow's build, here, with no box: <src> holds OnlyKey-Firmware,
 *                                                libraries and arduino-1.6.5-r5-teensy_127; writes <dir>/firmware/
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
/* the web app's firmware: Edge, the browser's way in, and the derived secrets its stores are encrypted under. Never a softKeyOnly plugin (build-hardkey.sh refuses them) */
/* version_control: our release on the maintainer's base - the version the key reports and the patches it carries (its version.json) */
const PLUGINS = ['edge', 'ctap_bridge', 'derive_secret', 'version_control'];
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
  const ours = require(path.join(EMU, 'plugins/version_control/plugin.js'));
  const site = (fs.readFileSync(path.join(EMU, 'plugins/ctap_bridge/src/okplugin_ctap_bridge.cpp'), 'utf8')
    .match(/#define CB_SITE_DEFAULT "([^"]+)"/) || [])[1];
  const want = {
    version: version.version,
    firmware: version.pins['OnlyKey-Firmware'],
    libraries: version.pins.libraries,
    /* the patches are the release's: exactly version_control's list (scripts/versions/v3.1.0.js picks them the same way) */
    fixes: ours.patches,
    release: `v${ours.version}`,
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
  for (const k of ['version', 'release', 'firmware', 'libraries', 'fixes', 'plugins', 'site']) {
    if (!same(m[k], want[k])) out.push(`${k}: posted ${JSON.stringify(m[k])}, the sources say ${JSON.stringify(want[k])}`);
  }
  for (const [p, h] of Object.entries(want.sources)) {
    const had = (m.sources || {})[p];
    if (had !== h) out.push(`${p}: built from ${had || '(not recorded)'}, now ${h}`);
  }
  if (m.buildHash !== want.buildHash) out.push(`build hash: posted ${m.buildHash || '(none)'}, the sources make ${want.buildHash}`);
  /* the record alone (main keeps no hex); a hex here (a bench build, untracked) must be the record's */
  if (!hexes.length) return out;
  if (hexes.length !== 1 || hexes[0] !== m.file) out.push(`firmware/ must hold only the manifest's hex (${m.file}); it holds ${hexes.join(', ')}`);
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
    'build it first: node tools/firmware.js build (then commit firmware/manifest.json)');
}

function build(force) {
  const want = expected();
  if (!force && fs.existsSync(path.join(DIR, 'manifest.json')) && posted().hexes.length && !differences().length) {
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
    /* the commit the workflow checks out to build the same hex (its tree hashes must still be `sources`) */
    emulatorCommit: git(EMU_REPO, 'rev-parse', 'HEAD'),
    debug: true,
    site: want.site,
    toolchain: TOOLCHAIN,
    built: new Date().toISOString().slice(0, 10),
    tested: false,
    sha256: sha256(fs.readFileSync(path.join(DIR, file))),
  };
  fs.writeFileSync(path.join(DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`firmware: built firmware/${file} (sha256 ${manifest.sha256.slice(0, 12)}), not yet tested - commit firmware/manifest.json`);
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

/*
 * THE WORKFLOW'S BUILD (.github/workflows/release.yml, its first job): the same build-hardkey.sh as `build`, run here
 * on the CI machine from the checkouts beside this repo - no box - TWICE, from the same sources and build stamp:
 *
 *   prod   DEBUG off: no debug console - the firmware a developer key runs for real
 *   test   DEBUG on: the debug console the kit and key 2's tests drive. It prints key data, so it is for test keys
 *          only - never live credentials, never a backup restored to it (Brad, 2026-10-28: "test firmware build exposes
 *          debugging and should not be used with live credentials or restore backup to it, because it will expose
 *          credentials"). The record (firmware/manifest.json) is this build's: its sha256 and "tested" are the test hex's.
 *
 * (Brad, 2026-10-28: "when github builds, it should do prod-release builds; only exception is firmware may provide both
 * test and prod builds".) The hexes and one manifest go to <out>/firmware/: the record's fields with `builds`, one
 * entry per hex - its file, sha256, debug, tested.
 *
 * THE SAME FILE, NOT THE SAME SOURCES (2026-10-28): the first workflow run built the record's build hash - same pins,
 * fixes, plugins, stamp - and got a different hex (8 bytes shorter; code, not strings) than the box build key 2 ran.
 * So the build is not yet reproducible across machines, and "tested" (the Downloads page: "until this exact file has
 * run on a hard key") stays only on a byte-identical file. A rebuild of the tested sources says so, untested. The prod
 * hex is never "tested": the kit drives a key through the debug console it does not have.
 */
function ciBuild(args) {
  const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? path.resolve(args[i + 1]) : null; };
  const out = opt('--out');
  const src = opt('--src');
  const kit = opt('--kit');
  if (!out || !src || !kit) fail('usage: node tools/firmware.js ci-build --out <dir> --src <dir> --kit <dir>');
  const want = expected();
  const record = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));
  const dest = path.join(out, 'firmware');
  fs.mkdirSync(dest, { recursive: true });
  const same = record.buildHash === want.buildHash;

  const buildOne = (flavor, debug) => {
    const work = path.join(out, `fw-work-${flavor}`);
    fs.mkdirSync(work, { recursive: true });
    console.log(`firmware: ci-build (${flavor}, DEBUG ${debug ? 'on' : 'off'}) ${want.version} @ ${want.firmware}/${want.libraries}, fixes ${want.fixes.join(' ')}, plugins ${PLUGINS.join(',')}, build ${want.buildHash}`);
    const r = spawnSync('bash', ['plugins/edge/tools/build-hardkey.sh'], {
      cwd: EMU,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
      /* the size guard (build-hardkey.sh LIMIT) gates the prod hex alone; the test hex's limit is the end of the flash,
         so its size is reported, never refused */
      env: { ...process.env, FW_PIN: want.firmware, LIB_PIN: want.libraries, PLUGINS: PLUGINS.join(','), BUILD_STAMP: stampOf(want.buildHash), FW_SRC: src, FW_OUT: work, KIT: kit, DEBUG: debug ? '1' : '0', ...(debug ? { LIMIT: '0x40000' } : {}) },
    });
    process.stdout.write(r.stdout || '');
    const image = ((r.stdout || '').match(/== \S+ 6\. (\S+\.hex)/) || [])[1];
    if (r.status !== 0 || !image) fail(`the ${flavor} build did not finish (see above)`);
    /* build-hardkey.sh names every image v<version>-test-...; the prod one says prod, without its -nodebug tag, and the
       test one says DANGEROUS first (Brad, 2026-10-28: "with DANGEROUS in the filename for test builds") */
    const file = debug ? `DANGEROUS-${path.basename(image)}` : path.basename(image).replace('-test-', '-prod-').replace('-nodebug', '');
    fs.copyFileSync(image, path.join(dest, file));
    const hex = fs.readFileSync(path.join(dest, file));
    /* the hex checks gate the prod hex alone (Brad, 2026-10-28: "the hex build gate that checks size and confirms the
       hex looks good, that check is only for the prod release firmware build"); the test hex's are reported */
    if (!carriesStamp(hex.toString('latin1'), stampOf(want.buildHash))) {
      if (!debug) fail(`${file} does not carry build stamp ${stampOf(want.buildHash)}`);
      console.log(`firmware: note - the test hex ${file} does not carry build stamp ${stampOf(want.buildHash)}`);
    }
    const digest = sha256(hex);
    /* only the test hex is the record's file; tested stays only on that exact file */
    const exact = debug && same && record.sha256 === digest;
    const entry = { flavor, file, sha256: digest, debug, tested: exact && record.tested === true };
    if (entry.tested) entry.testedOn = record.testedOn;
    const verdict = entry.tested ? ` - tested: ${entry.testedOn}`
      : !debug ? ' - prod (no debug console): not kit-tested'
        : exact ? ' - the recorded file, not yet tested'
          : same ? ` - the recorded sources, but not the recorded file (sha256 ${String(record.sha256).slice(0, 12)}): untested`
            : ' - NOT the recorded build: untested';
    console.log(`firmware: ${dest}/${file} (sha256 ${digest.slice(0, 12)})${verdict}`);
    return entry;
  };

  const builds = [buildOne('prod', false), buildOne('test', true)];
  if (builds[0].file === builds[1].file) fail('the prod and test hexes have one name - build-hardkey.sh must tag DEBUG off');
  const { file, sha256: _s, tested: _t, testedOn: _o, debug: _d, ...common } = record;
  const manifest = {
    ...common,
    buildHash: want.buildHash,
    sources: want.sources,
    built: new Date().toISOString().slice(0, 10),
    builtBy: process.env.GITHUB_RUN_ID ? `release workflow run ${process.env.GITHUB_RUN_ID}` : 'ci-build',
    builds,
  };
  fs.writeFileSync(path.join(dest, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

/*
 * THE PROD HEX ALONE, for what the release puts in front of people: the APK's assets and the web app's Downloads page
 * (Brad, 2026-10-28: "the test hex is not displayed on the webapp to download, only in the github release section").
 * In <dir> (a ci-build firmware/ folder): every hex but the prod one is removed and the manifest lists the prod build
 * only. The test hex reaches the GitHub release from the workflow's own artifact, never through here.
 */
function prodOnly(dir) {
  if (!dir) fail('usage: node tools/firmware.js prod-only <dir>');
  const file = path.join(dir, 'manifest.json');
  const m = JSON.parse(fs.readFileSync(file, 'utf8'));
  const prod = (m.builds || []).filter((b) => b.flavor === 'prod');
  if (prod.length !== 1) fail(`${file} lists ${prod.length} prod builds - a ci-build manifest lists one`);
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.hex') && f !== prod[0].file) fs.rmSync(path.join(dir, f));
  if (!fs.existsSync(path.join(dir, prod[0].file))) fail(`no ${prod[0].file} in ${dir}`);
  m.builds = prod;
  fs.writeFileSync(file, `${JSON.stringify(m, null, 2)}\n`);
  console.log(`firmware: ${dir} holds the prod hex alone (${prod[0].file})`);
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
else if (cmd === 'ci-build') ciBuild(process.argv.slice(3));
else if (cmd === 'prod-only') prodOnly(arg);
else fail('usage: node tools/firmware.js build | tested "<what ran>" | check [<rev>] | ci-build --out <dir> --src <dir> --kit <dir> | prod-only <dir> | install-hook');

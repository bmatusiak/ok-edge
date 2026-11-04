#!/usr/bin/env node
'use strict';
/*
 * THE RELEASE MANIFEST - ONE FILE SAYING WHAT A PUBLISHED RELEASE IS (Brad, 2026-11-04: "the publish step should create a
 * final manifest, so that can be scraped for checking for updates ... update notices have a unified place to check").
 * Run by the release workflow's publish job, the one job that holds every part, over the artifacts the run built:
 *   firmware/manifest.json            the hexes and what they are built from (tools/firmware.js prod-only)
 *   android/manifest.json             the APK, and the soft key inside it (android-manifest.js --soft-key)
 *   desktop-<os>/desktop-<os>.json    each desktop package, and its soft key (desktop-package.js)
 *   site/docs/release.json            the web app's own build (tools/web-build.js writes it unpublished)
 * and writes, into the site the cloudflare branch takes:
 *   docs/release.json   served at /release.json - the Downloads pages and every app's update check read it
 *   README.md           the branch's front page, generated from the same record so the two never disagree
 * A part whose soft key carries other fixes than the firmware record is refused: nothing is published from it.
 *
 *   node tools/release/release-manifest.js --artifacts <dir> --site <dir> --repo <owner/name> --tag <tag>
 *     --version <x.y.z> --code <n> --commit <sha> --run <id>
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const need = ['--artifacts', '--site', '--repo', '--tag', '--version', '--code', '--commit', '--run'];
const missing = need.filter((k) => !opt(k));
if (missing.length) { console.error(`release-manifest: missing ${missing.join(' ')}`); process.exit(1); }
const fail = (why) => { console.error(`release-manifest: ${why}`); process.exit(1); };
const ART = path.resolve(opt('--artifacts'));
const SITE = path.resolve(opt('--site'));
const json = (...p) => { const f = path.join(...p); if (!fs.existsSync(f)) fail(`no ${path.relative(process.cwd(), f)}`); return JSON.parse(fs.readFileSync(f, 'utf8')); };
const assetUrl = (file) => `https://github.com/${opt('--repo')}/releases/download/${opt('--tag')}/${file}`;

/* ---------------------------------------------------------------- the parts */
const fw = json(ART, 'firmware', 'manifest.json');
const firmware = {
  version: fw.version,
  release: fw.release,
  sources: { 'OnlyKey-Firmware': fw.firmware, libraries: fw.libraries },
  fixes: fw.fixes || [],
  plugins: fw.plugins || [],
  emulatorCommit: fw.emulatorCommit,
  buildHash: fw.buildHash,
  builds: (fw.builds || []).map((b) => ({ flavor: b.flavor, file: b.file, sha256: b.sha256, debug: !!b.debug, tested: !!b.tested, ...(b.testedOn ? { testedOn: b.testedOn } : {}), url: assetUrl(b.file) })),
};
const softKey = (s, where) => {
  if (!s) fail(`${where} names no soft key - its manifest must carry its build record (softKey)`);
  return { version: s.version, plugins: s.plugins || [], fixes: s.fixes || [] };
};
const app = (m, where) => ({
  file: m.file, url: m.url, sha256: m.sha256, size: m.size, commit: m.commit,
  ...(m.certSha256 ? { certSha256: m.certSha256, appId: m.appId } : {}),
  softKey: softKey(m.softKey, where),
});
const android = app(json(ART, 'android', 'manifest.json'), 'the Android app');
const desktop = {};
for (const os of ['windows', 'linux']) desktop[os] = app(json(ART, `desktop-${os}`, `desktop-${os}.json`), `the ${os} desktop`);
const webOwn = json(SITE, 'docs', 'release.json');
const web = webOwn.apps && webOwn.apps.web;
if (!web || !web.build) fail('the site carries no web build record (docs/release.json apps.web, tools/web-build.js)');

/* ---------------------------------------------------------------- one set of fixes, everywhere */
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const wrong = [['android', android], ['desktop windows', desktop.windows], ['desktop linux', desktop.linux]]
  .filter(([, a]) => !same(a.softKey.fixes, firmware.fixes))
  .map(([name, a]) => `${name}'s soft key carries ${JSON.stringify(a.softKey.fixes)}`);
if (wrong.length) fail(`the parts disagree with the firmware record's fixes ${JSON.stringify(firmware.fixes)}: ${wrong.join('; ')}`);

const release = {
  name: 'ok-edge',
  note: 'an unofficial research and development version - not an official OnlyKey product',
  published: true,
  version: opt('--version'),
  code: Number(opt('--code')),
  tag: opt('--tag'),
  commit: opt('--commit'),
  run: opt('--run'),
  publishedAt: new Date().toISOString(),
  releaseUrl: `https://github.com/${opt('--repo')}/releases/tag/${opt('--tag')}`,
  firmware,
  apps: { android, desktop, web: { build: web.build, commit: web.commit, at: web.at } },
};
fs.writeFileSync(path.join(SITE, 'docs', 'release.json'), `${JSON.stringify(release, null, 2)}\n`);

/* ---------------------------------------------------------------- the README, from the same record */
const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;
const row = (what, a) => `| ${what} | [${a.file}](${a.url}) | ${mb(a.size)} | \`${a.sha256}\` |`;
const readme = [
  `# ok-edge ${release.version} (${release.tag})`,
  '',
  `${release.note}. Built by the release workflow (run ${release.run}) from \`${release.commit.slice(0, 7)}\` on ${release.publishedAt.slice(0, 10)}.`,
  `The release: ${release.releaseUrl}. Everything below is \`docs/release.json\`, which the site serves at \`/release.json\`.`,
  '',
  '## Downloads',
  '',
  '| | file | size | sha256 |',
  '|---|---|---|---|',
  row('Android app', android),
  row('Desktop app, Windows (x64)', desktop.windows),
  row('Desktop app, Linux (x64)', desktop.linux),
  ...firmware.builds.map((b) => `| Firmware, ${b.flavor}${b.debug ? ' (DEBUG console - test keys only)' : ''} | [${b.file}](${b.url}) | | \`${b.sha256}\` |`),
  '',
  `The Android app is signed with the certificate \`${android.certSha256}\`.`,
  'Check a download: `sha256sum <file>` (Linux) or `certutil -hashfile <file> SHA256` (Windows) must print the sha256 above.',
  '',
  '## Firmware',
  '',
  `OnlyKey firmware ${firmware.version} (OnlyKey-Firmware \`${firmware.sources['OnlyKey-Firmware']}\`, libraries \`${firmware.sources.libraries}\`), built from node-onlykey-emulator \`${String(firmware.emulatorCommit).slice(0, 7)}\` (build ${firmware.buildHash}).`,
  '',
  `- fixes: ${firmware.fixes.map((f) => `\`${f}\``).join(', ') || 'none'}`,
  `- plugins: ${firmware.plugins.map((p) => `\`${p}\``).join(', ') || 'none'}`,
  '- the prod hex is on the site and in the Android app; the test hex (DEBUG console - it prints key data) is on the GitHub release alone, for test keys only.',
  '',
  '## The soft key in each app',
  '',
  '| app | version | fixes | plugins |',
  '|---|---|---|---|',
  ...[['Android', android], ['Desktop, Windows', desktop.windows], ['Desktop, Linux', desktop.linux]].map(([n, a]) =>
    `| ${n} | ${a.softKey.version} | ${a.softKey.fixes.join(', ')} | ${a.softKey.plugins.join(', ')} |`),
  '',
  `The web app (build \`${web.build}\`) has no soft key: it uses the key in your hand.`,
  '',
  '## This branch',
  '',
  '- `docs/` - the web app, `docs/firmware/` (the prod hex) and `docs/release.json`; `release.json` here is a link to it',
  '- `worker/`, `wrangler.json` - the Worker; Cloudflare deploys this branch as it is, nothing is built here (by hand: `npx wrangler deploy` in this folder)',
  '- nothing here is source: each release replaces all of it; the source and the workflow are on `main` (`.github/workflows/release.yml`)',
  '',
  'This product includes software developed by CryptoTrust LLC. for the OnlyKey Project (https://crp.to/ok)',
  '',
].join('\n');
fs.writeFileSync(path.join(SITE, 'README.md'), readme);
console.log(`release-manifest: ${release.tag} - firmware ${firmware.version} fixes ${firmware.fixes.join(',')}, android + desktop (windows, linux) agree; docs/release.json and README.md written`);

#!/usr/bin/env node
'use strict';
/*
 * THE CLOUDFLARE BRANCH'S CONTENTS (the release workflow's last job, .github/workflows/release.yml).
 *
 * Brad, 2026-10-27: "push the builds to cloudflare, cloudflare does not need to build ... this will keep our main from
 * having builds"; then "cloudflare builds are disabled". So the cloudflare branch holds the finished site - nothing on
 * it is built again: the web app (docs/, with docs/firmware and docs/android), the Worker already bundled by wrangler
 * (worker/index.js, its node-onlykey-lib inside), and a wrangler.json that names them with no build command and no
 * bundling. `npx wrangler deploy` in that folder deploys exactly what the workflow built - the workflow runs it when the
 * repo has a CLOUDFLARE_API_TOKEN secret; otherwise the branch is the record of the release and is deployed by hand.
 *
 *   node tools/release/cloudflare-site.js --docs <dir> --worker <dir> --out <dir> --commit <sha> --tag <tag>
 *
 * The bindings (the Durable Object rooms, the assets' single-page fallback, /ws/* to the Worker first) are main's
 * wrangler.jsonc, so the deployed site cannot drift from the one `wrangler dev` runs locally.
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const docs = opt('--docs');
const worker = opt('--worker');
const out = opt('--out');
const commit = opt('--commit') || '';
const tag = opt('--tag') || '';
if (!docs || !worker || !out) {
  console.error('usage: node tools/release/cloudflare-site.js --docs <dir> --worker <dir> --out <dir> [--commit <sha>] [--tag <tag>]');
  process.exit(1);
}
const root = path.join(__dirname, '..', '..');

/* main's wrangler.jsonc without its comments: block comments only, and whole-line // ones (no URL holds a // here) */
const jsonc = fs.readFileSync(path.join(root, 'wrangler.jsonc'), 'utf8');
const config = JSON.parse(jsonc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''));
delete config.$schema;
delete config.build;
config.main = 'worker/index.js';
config.no_bundle = true;
config.assets = { ...config.assets, directory: './docs' };

const entry = path.join(worker, 'index.js');
if (!fs.existsSync(entry)) { console.error(`cloudflare-site: no bundled Worker at ${entry}`); process.exit(1); }
if (!fs.existsSync(path.join(docs, 'index.html'))) { console.error(`cloudflare-site: no web app at ${docs}`); process.exit(1); }

/* everything but .git is replaced: a file dropped from the site is dropped from the branch */
fs.mkdirSync(out, { recursive: true });
for (const f of fs.readdirSync(out)) if (f !== '.git') fs.rmSync(path.join(out, f), { recursive: true, force: true });
fs.cpSync(docs, path.join(out, 'docs'), { recursive: true });
fs.mkdirSync(path.join(out, 'worker'), { recursive: true });
fs.copyFileSync(entry, path.join(out, 'worker', 'index.js'));
fs.writeFileSync(path.join(out, 'wrangler.json'), `${JSON.stringify(config, null, 2)}\n`);
/* the wrangler main runs with, so `npx wrangler deploy` here is the same tool */
const wrangler = (JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).scripts['server:dev'].match(/wrangler@([\d.]+)/) || [])[1];
fs.writeFileSync(path.join(out, 'package.json'), `${JSON.stringify({
  name: 'ok-edge-site',
  private: true,
  description: 'The built OnlyKey Edge site (release workflow output) - deploy with npx wrangler deploy; nothing here is built',
  devDependencies: wrangler ? { wrangler } : {},
}, null, 2)}\n`);
fs.writeFileSync(path.join(out, 'README.md'), [
  '# ok-edge: the built site',
  '',
  `Release ${tag || '(untagged)'}, built by the release workflow from main ${commit}. Nothing on this branch is source:`,
  'each release replaces all of it. The source and the workflow are on `main` (`.github/workflows/release.yml`).',
  '',
  '- `docs/` - the web app, with `docs/firmware/` (the developer-key hex) and `docs/android/manifest.json`',
  '- `worker/index.js` - the Worker, bundled (wrangler.json: no build, no bundling)',
  '',
  'Deploy: `npx wrangler deploy` in this folder.',
  '',
].join('\n'));
console.log(`cloudflare-site: ${out} - docs/, worker/index.js, wrangler.json (main ${config.main}, wrangler ${wrangler || '?'})`);

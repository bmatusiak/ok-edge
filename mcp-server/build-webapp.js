// wrangler's build step (wrangler.jsonc build.command) - it runs before `wrangler deploy` AND before `wrangler dev`.
// Cloudflare's build (a clean clone: no docs/ yet, CI set) builds the RELEASE web app into docs/. A local `wrangler dev`
// keeps the docs/ already built - the box's --dev build (tools/box/webapp.sh build) - instead of replacing it on every
// start; build it with `npm run build:webapp` or `npm run build:webapp:release` first.
// Either way firmware/ (the developer-key firmware the login page offers, firmware/README.md) is published at
// docs/firmware/ - copied after the export, which empties docs/.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const docs = path.join(root, 'docs');
const ci = process.env.WORKERS_CI || process.env.CI;
if (!ci && fs.existsSync(path.join(docs, 'index.html'))) {
  console.log('[build] docs/ is built - kept (a local run; Cloudflare builds the release web app itself)');
} else {
  execSync('npm run build:webapp:release', { cwd: root, stdio: 'inherit' });
}
const out = path.join(docs, 'firmware');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const f of fs.readdirSync(path.join(root, 'firmware'))) {
  if (/\.(hex|json)$/.test(f)) fs.copyFileSync(path.join(root, 'firmware', f), path.join(out, f));
}
console.log(`[build] firmware/ published at docs/firmware/ (${fs.readdirSync(out).join(', ')})`);

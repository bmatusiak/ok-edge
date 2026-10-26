// wrangler's build step (wrangler.jsonc build.command) - it runs before `wrangler deploy` AND before `wrangler dev`.
// Cloudflare's build (a clean clone: no docs/ yet, CI set) builds the RELEASE web app into docs/. A local `wrangler dev`
// keeps the docs/ already built - the box's --dev build (tools/box/webapp.sh build) - instead of replacing it on every
// start; build it with `npm run build:webapp` or `npm run build:webapp:release` first.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const ci = process.env.WORKERS_CI || process.env.CI;
if (!ci && fs.existsSync(path.join(root, 'docs', 'index.html'))) {
  console.log('[build] docs/ is built - kept (a local run; Cloudflare builds the release web app itself)');
  process.exit(0);
}
execSync('npm run build:webapp:release', { cwd: root, stdio: 'inherit' });

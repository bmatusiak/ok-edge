#!/usr/bin/env node
'use strict';
/*
 * THE WEB APP'S BUILD (npm run build:webapp / build:webapp:release): the Expo export into docs/, stamped with a build
 * version, then the files that let it load from a cache and learn of a newer build (Brad, 2026-10-29: a service worker,
 * "using the cache version, and updating"; the splash checks; a banner when a tab runs an old build):
 *   docs/version.json   {version, commit, at} - asked with no cache by every page (src/webUpdate.ts)
 *   docs/sw.js          the service worker (tools/web/sw.template.js) with this version and the files to precache
 *   docs/_headers       no caching of those two by the server's static assets (Cloudflare reads _headers)
 * The version reaches the page as EXPO_PUBLIC_WEB_BUILD (Expo inlines it): a page whose version differs from
 * version.json's is an old build.
 *
 *   node tools/web-build.js [--dev]
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const docs = path.join(root, 'docs');
const dev = process.argv.includes('--dev');
let commit = process.env.EXPO_PUBLIC_APP_COMMIT || process.env.WORKERS_CI_COMMIT_SHA || '';
try { commit = commit || execSync('git rev-parse HEAD', { cwd: root }).toString().trim(); } catch { /* not a git checkout */ }
const version = `${(commit || 'local').slice(0, 7)}-${Date.now().toString(36)}`;

execSync(`npx expo export --platform web ${dev ? '--dev ' : ''}--output-dir docs`, {
  cwd: root, stdio: 'inherit', env: { ...process.env, EXPO_PUBLIC_WEB_BUILD: version, EXPO_PUBLIC_APP_COMMIT: commit },
});

/* every file the export made, as the page asks for it - not the firmware (published after, large) or the maps */
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    const rel = `/${path.relative(docs, p).split(path.sep).join('/')}`;
    if (e.isDirectory()) { if (rel !== '/firmware') walk(p); continue; }
    if (/\.map$/.test(rel) || rel === '/sw.js' || rel === '/version.json' || rel === '/_headers') continue;
    files.push(rel);
  }
})(docs);
/* the page itself as '/': the server redirects /index.html there (the worker serves '/' for every route) */
const page = files.indexOf('/index.html');
if (page !== -1) files[page] = '/';
files.sort();

fs.writeFileSync(path.join(docs, 'version.json'), `${JSON.stringify({ version, commit, at: new Date().toISOString(), dev })}\n`);
const template = fs.readFileSync(path.join(__dirname, 'web', 'sw.template.js'), 'utf8');
fs.writeFileSync(path.join(docs, 'sw.js'), template.replace("'__VERSION__'", JSON.stringify(version)).replace('__FILES__', JSON.stringify(files)));
fs.writeFileSync(path.join(docs, '_headers'), '/sw.js\n  Cache-Control: no-cache\n/version.json\n  Cache-Control: no-store\n');
console.log(`[web-build] ${version}: ${files.length} file(s) precached by docs/sw.js`);

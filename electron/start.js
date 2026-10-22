'use strict';
/*
 * `npm run electron`: Electron on electron/main.js.
 *
 * WITHOUT OKEDGE_WEB_URL the window loads the web export in dist/web, so that export must be the
 * code as it is NOW. It is rebuilt here, before the window opens, whenever any source it is built
 * from is newer than it: a plain launch once showed a days-old export (the hard key's USB module
 * still a stub, "no hard key attached") while the same code passed its tests on Metro's live page.
 * A launch is never allowed to show older code than the tree holds.
 *
 * With OKEDGE_WEB_URL (Metro's live page, as tools/e2e-desktop.js runs it) nothing is built.
 */
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const electron = require('electron');

const ROOT = path.join(__dirname, '..');
const EXPORT = path.join(ROOT, 'dist', 'web', 'index.html');

/* what the web export is built from: the app's JavaScript and assets, and the lockfile (a lib re-pin) */
const SOURCE_FILES = ['App.tsx', 'PhoneApp.tsx', 'index.ts', 'app.json', 'metro.config.js', 'tsconfig.json',
  'package.json', 'package-lock.json'];
const SOURCE_DIRS = ['src', '__e2e_tests__', 'assets', 'modules'];
/* native code and build output under those dirs are not in the web export */
const SKIP = new Set(['node_modules', 'android', 'ios', 'build', '.gradle', '.cxx']);

function newest(p) {
  let st;
  try { st = fs.statSync(p); } catch { return 0; }
  if (!st.isDirectory()) return st.mtimeMs;
  let latest = 0;
  for (const e of fs.readdirSync(p, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    latest = Math.max(latest, newest(path.join(p, e.name)));
  }
  return latest;
}

function exportIsStale() {
  let built;
  try { built = fs.statSync(EXPORT).mtimeMs; } catch { return 'there is no web export yet'; }
  const sources = Math.max(...[...SOURCE_FILES, ...SOURCE_DIRS].map((p) => newest(path.join(ROOT, p))));
  return sources > built ? 'the sources changed since the web export was built' : null;
}

if (!process.env.OKEDGE_WEB_URL) {
  const why = exportIsStale();
  if (why) {
    console.log(`[start] ${why} - rebuilding dist/web first (npm run build:web)`);
    const r = spawnSync('npm', ['run', 'build:web'], { cwd: ROOT, stdio: 'inherit', shell: true });
    if (r.status !== 0) {
      console.error('[start] the web export failed to build - not opening an older one');
      process.exit(r.status || 1);
    }
  }
}

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
spawn(electron, [path.join(__dirname, 'main.js'), ...process.argv.slice(2)], { stdio: 'inherit', env })
  .on('exit', (code) => process.exit(code ?? 0));

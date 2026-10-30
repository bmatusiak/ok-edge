/**
 * Metro: Expo's defaults plus ok-rn's three additions (ok-rn/metro.config.js has the full notes).
 */
const path = require('path');
const fs = require('fs');
const { getDefaultConfig } = require('expo/metro-config');

/* the desktop window's build (PLATFORM FILES, below): x.desktop.ts before x.web.ts, in this app's own files only */
const DESKTOP_BUILD = process.env.OKEDGE_SHELL === 'desktop';
const OWN = path.join(__dirname, 'src') + path.sep;

const config = getDefaultConfig(__dirname);
const workspace = path.resolve(__dirname, '..');

/*
 * test-moniker (the in-app e2e runner) is a sibling installed with `file:`, so npm symlinks it.
 * Metro resolves a symlink to its real path and serves nothing outside a watched root, and a file
 * inside a linked sibling resolves node_modules from the sibling - so the sibling is watched and
 * this project's node_modules is an explicit search path (Babel's injected helpers live here).
 * Only when the sibling is there: a clone on its own (Cloudflare's build) has no ../test-moniker, Metro refuses a
 * watch folder that does not exist, and the bundle never imports it (the harness is vendored in __e2e_tests__).
 */
const moniker = path.join(workspace, 'test-moniker');
if (require('fs').existsSync(moniker)) config.watchFolders = [...(config.watchFolders || []), moniker];
config.resolver.nodeModulesPaths = [path.join(__dirname, 'node_modules')];

/*
 * DO NOT WATCH THE NATIVE BUILD DIRECTORIES: Metro dies if one vanishes mid-build, and none of
 * it is bundled JavaScript - CMake's bookkeeping, compiled output and the fetched OpenSSL.
 */
config.resolver.blockList = [
  /android[/\\](?:[^/\\]+[/\\])?(?:build|\.cxx|\.openssl)[/\\]/,
];

/*
 * THE TESTING SCREEN IS NOT IN A RELEASE BUNDLE. Testing mode bypasses the PIN and exposes a
 * factory reset, a soft-key wipe, the on-device test runner and the raw USB surface.
 * useTestingMode refuses it outside __DEV__, which makes it unreachable - and unreachable is not
 * absent: Metro puts every statically imported module in the graph. So for the bundle a release
 * build embeds (context.dev false) the module is swapped for its stub at resolution time, as in
 * ok-rn.
 */
const resolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (!context.dev && /(^|[/\\])TestingScreen$/.test(moduleName)) {
    return { type: 'sourceFile', filePath: path.join(__dirname, 'src', 'screens', 'TestingScreen.release.tsx') };
  }
  /*
   * THE PHONE'S NATIVE MODULES ON THE DESKTOP (stage 4): the web bundle (Electron's page) gets
   * each spec's desktop version, src/desktop/specs/<Native…>.ts - what that module really has on
   * this shell (module.ts). The app code that imports the spec is the phone's, unchanged.
   */
  const spec = platform === 'web' && /^okedge-native\/specs\/(Native[A-Za-z]+)$/.exec(moduleName);
  if (spec) {
    return { type: 'sourceFile', filePath: path.join(__dirname, 'src', 'desktop', 'specs', `${spec[1]}.ts`) };
  }
  const resolved = (resolveRequest || context.resolveRequest)(context, moduleName, platform);
  /*
   * PLATFORM FILES FOR THE DESKTOP (Brad, 2026-10-30: "each platform gets their own .platform.js for platform specific
   * replacement - this can apply to a rectify service"; PROPOSAL-rectify-ok-edge.md rule 2). Metro picks x.android.ts
   * and x.web.ts by itself; the desktop window is a web build too, so its build says so (OKEDGE_SHELL=desktop:
   * build:web, build:web:test, web:desktop) and a project file with an x.desktop.ts beside it resolves to that one.
   * Only this app's own files - never a package's.
   */
  if (DESKTOP_BUILD && platform === 'web' && resolved && resolved.type === 'sourceFile' && resolved.filePath.startsWith(OWN)) {
    const m = /^(.*?)(?:\.web)?\.(tsx?|jsx?)$/.exec(resolved.filePath);
    if (m) {
      for (const ext of ['ts', 'tsx', 'js']) {
        const alt = `${m[1]}.desktop.${ext}`;
        if (fs.existsSync(alt)) return { type: 'sourceFile', filePath: alt };
      }
    }
  }
  return resolved;
};

module.exports = config;

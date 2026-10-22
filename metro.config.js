/**
 * Metro: Expo's defaults plus ok-rn's three additions (ok-rn/metro.config.js has the full notes).
 */
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const workspace = path.resolve(__dirname, '..');

/*
 * test-moniker (the in-app e2e runner) is a sibling installed with `file:`, so npm symlinks it.
 * Metro resolves a symlink to its real path and serves nothing outside a watched root, and a file
 * inside a linked sibling resolves node_modules from the sibling - so the sibling is watched and
 * this project's node_modules is an explicit search path (Babel's injected helpers live here).
 */
config.watchFolders = [...(config.watchFolders || []), path.join(workspace, 'test-moniker')];
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
  return (resolveRequest || context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;

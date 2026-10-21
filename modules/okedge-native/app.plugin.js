/**
 * THE SOFT KEY IN THE ANDROID BUILD (expo prebuild writes android/, so this is where it is told).
 *
 * The soft key is node-onlykey-emulator's Android library (emulator/android, Gradle project
 * `:okemu`), built from the emulator checkout - one firmware glue tree for the phone, the desktop and
 * the kit (ok-edge stage 1b). This plugin:
 *   - includes `:okemu` in settings.gradle, from OKEDGE_EMULATOR or the sibling checkout
 *     ../node-onlykey-emulator (the workspace layout; the firmware checkouts sit beside it);
 *   - names the soft key in gradle.properties, so a plain `gradlew assemble…` always stages the same
 *     firmware: the plugins every phone build needs (config, edge, key_chain, fix_usertimeout -
 *     without them the soft key boots the empty base slot) and src/generated/ as the folder for
 *     firmware.json, which src/buildInfo.ts reads.
 */
const path = require('path');
const { withSettingsGradle, withGradleProperties } = require('expo/config-plugins');

const PLUGINS = 'config,edge,key_chain,fix_usertimeout';

const withOkEmuProject = (config) => withSettingsGradle(config, (c) => {
  if (!c.modResults.contents.includes("include ':okemu'")) {
    c.modResults.contents += `
// the soft key: node-onlykey-emulator's Android library (modules/okedge-native/app.plugin.js)
def okemuRepo = System.getenv('OKEDGE_EMULATOR') ? new File(System.getenv('OKEDGE_EMULATOR')) : new File(rootDir, '../../node-onlykey-emulator')
include ':okemu'
project(':okemu').projectDir = new File(okemuRepo, 'emulator/android')
`;
  }
  return c;
});

const withOkEmuProperties = (config) => withGradleProperties(config, (c) => {
  const set = (key, value) => {
    const row = c.modResults.find((r) => r.type === 'property' && r.key === key);
    if (row) row.value = value;
    else c.modResults.push({ type: 'property', key, value });
  };
  set('okemuPlugins', PLUGINS);
  set('okemuAppOut', path.resolve(c.modRequest.projectRoot, 'src', 'generated').replace(/\\/g, '/'));
  return c;
});

module.exports = (config) => withOkEmuProperties(withOkEmuProject(config));

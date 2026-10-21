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

/*
 * THE APP'S OWN CALLS INTO THE MODULES - the three ok-rn's MainApplication / MainActivity make,
 * at the same points (prebuild writes those files, so they are added here):
 *   - NativeShareModule.wipeSharedDir before React Native loads: a backup left mid-share is wiped
 *   - PressAlert.start after it: the soft key's press notification and sounds
 *   - NativeEdgeAlertModule.fromIntent in onCreate and onNewIntent: the app opened from an Edge alarm
 * Each insertion is marked, so a second prebuild does not add it twice.
 */
const { withMainApplication, withMainActivity } = require('expo/config-plugins');

const MARK = '// okedge-native:';
const insert = (src, anchor, text, after = true) => {
  if (src.includes(`${MARK} ${text.trim().split('\n')[0]}`)) return src;
  const at = src.indexOf(anchor);
  if (at < 0) throw new Error(`okedge-native: "${anchor}" not found - the generated file changed; update app.plugin.js`);
  const lines = text.trim().split('\n').map((l, i) => (i === 0 ? `${l} ${MARK} ${l}` : l));
  const block = `\n    ${lines.join('\n    ')}`;
  return after ? src.slice(0, at + anchor.length) + block + src.slice(at + anchor.length)
    : src.slice(0, at) + `${lines.join('\n    ')}\n    ` + src.slice(at);
};

const withAppCalls = (config) => withMainApplication(config, (c) => {
  let s = c.modResults.contents;
  s = insert(s, 'loadReactNative(this)', 'com.okrn.share.NativeShareModule.wipeSharedDir(this)', false);
  s = insert(s, 'loadReactNative(this)', 'com.okrn.emu.PressAlert.start(this)');
  c.modResults.contents = s;
  return c;
});

const withActivityCalls = (config) => withMainActivity(config, (c) => {
  let s = c.modResults.contents;
  s = insert(s, 'super.onCreate(null)', 'com.okrn.emu.NativeEdgeAlertModule.fromIntent(intent)');
  if (!s.includes('override fun onNewIntent')) {
    s = insert(s, 'override fun getMainComponentName', [
      'override fun onNewIntent(intent: android.content.Intent) {',
      '  super.onNewIntent(intent)',
      '  com.okrn.emu.NativeEdgeAlertModule.fromIntent(intent)',
      '}',
      '',
    ].join('\n'), false);
  }
  c.modResults.contents = s;
  return c;
});

module.exports = (config) => withActivityCalls(withAppCalls(withOkEmuProperties(withOkEmuProject(config))));

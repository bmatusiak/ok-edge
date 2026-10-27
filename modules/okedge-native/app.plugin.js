/**
 * THE SOFT KEY IN THE ANDROID BUILD (expo prebuild writes android/, so this is where it is told).
 *
 * The soft key is node-onlykey-emulator's Android library (emulator/android, Gradle project
 * `:okemu`), built from the emulator checkout - one firmware glue tree for the phone, the desktop and
 * the kit (ok-edge stage 1b). This plugin:
 *   - includes `:okemu` in settings.gradle, from OKEDGE_EMULATOR or the sibling checkout
 *     ../node-onlykey-emulator (the workspace layout; the firmware checkouts sit beside it);
 *   - names the soft key in gradle.properties, so a plain `gradlew assemble…` always stages the same
 *     firmware: the plugins every phone build needs (config, edge, key_chain, derive_secret - the last one
 *     derives the key the bucket is sealed under;
 *     without them the soft key boots the empty base slot) and src/generated/ as the folder for
 *     firmware.json, which src/buildInfo.ts reads.
 */
const path = require('path');
const { withSettingsGradle, withGradleProperties } = require('expo/config-plugins');

const PLUGINS = 'config,edge,key_chain,derive_secret';

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
  /*
   * THE SOFT KEY'S FIRMWARE IS THE RC PIN PLUS ITS FIXES (Brad, 2026-10-25: the patches "patched on top of the pin from
   * the RC"): the emulator's v3.1.0 recipe - libraries 37aa531 with 0008-0011 (emulator scripts/versions/fixes-3.1.0.js,
   * the patch files beside it) - never whatever the local libraries checkout holds. The Pixel's soft key was built from
   * a working tree without 0011, and its backup could not be restored (the composite PQC record written 896 bytes long).
   * OKEDGE_FIRMWARE=tree builds the working tree instead, for firmware work; another release name stages that release.
   */
  const firmware = process.env.OKEDGE_FIRMWARE || 'v3.1.0';
  if (firmware !== 'tree') set('okemuVersion', firmware);
  /* a debug build loads its JS from ok-edge's Metro on 8082 (metro.pm2.config.js); ok-rn's keeps 8081 */
  set('reactNativeDevServerPort', '8082');
  /* the debug build's KSP pass (Expo's modules; ok-rn has none) ran out of metaspace at the
     template's 512 MB: java.lang.OutOfMemoryError: Metaspace */
  set('org.gradle.jvmargs', '-Xmx2048m -XX:MaxMetaspaceSize=1024m');
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

/*
 * THE APP MODULE'S TWO ADDITIONS from ok-rn's android/app/build.gradle (its notes have the detail):
 *   - the C++ object tree on a short path, Windows only: React Native's codegen objects embed the
 *     whole mangled source path (~130 characters) and a RELEASE build under <project>/android/app/
 *     .cxx/RelWithDebInfo passes MAX_PATH - ninja fails on react-native-safe-area-context. Skipped
 *     when the drive is absent; OKEDGE_CXX_DIR overrides. Not ok-rn's folder, so the two apps
 *     never share objects.
 *   - the signed firmware releases (ok-edge/signed_firmware) bundled as assets under
 *     signed_firmware/, the name the app asks for - an update works in airplane mode.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const APP_GRADLE = `
// okedge-native: the C++ staging path and the signed firmware assets (modules/okedge-native/app.plugin.js)
def signedFirmwareAssets = file("$buildDir/signedFirmwareAssets")
tasks.register('stageSignedFirmware', Copy) {
    from "$rootDir/../signed_firmware"
    into new File(signedFirmwareAssets, 'signed_firmware')
}
preBuild.dependsOn stageSignedFirmware
android {
    sourceSets {
        main {
            assets.srcDirs += [signedFirmwareAssets]
        }
    }
    externalNativeBuild {
        cmake {
            def onWindows = System.getProperty('os.name').toLowerCase().contains('windows')
            def staging = System.getenv('OKEDGE_CXX_DIR') ?: 'D:/okedgecxx'
            if (onWindows && file(staging).parentFile?.exists()) {
                buildStagingDirectory = file(staging)
            }
        }
    }
    /*
     * ninja checks the path it is GIVEN, which is relative to the build folder - and that relative
     * object path alone (CMakeFiles/<target>.dir/C_/Users/.../ok-edge/node_modules/react-native-
     * safe-area-context/common/cpp/.../RNCSafeAreaViewShadowNode.cpp.o) passes 260, so no staging
     * path can fix it. CMake sets no object-path limit when it cross-compiles for Android; with one
     * it hashes the long object names. Windows hosts only.
     */
    defaultConfig {
        externalNativeBuild {
            cmake {
                if (System.getProperty('os.name').toLowerCase().contains('windows')) {
                    arguments "-DCMAKE_OBJECT_PATH_MAX=250"
                }
            }
        }
        /*
         * OKEDGE_APP_ID=com.okrn builds the REPLACEMENT: ok-edge installed over ok-rn as an update, so
         * the app's data - the soft key's flash.bin/eeprom.bin, AsyncStorage, Keystore keys - is
         * kept and tested as it is. Unset, ok-edge is com.okedge beside ok-rn. Read at build time,
         * so switching needs no prebuild.
         *
         * versionCode = 1000 + this repo's commit count: above every ok-rn build (ok-rn's is its own
         * commit count, 623 at 0.0.7), so the replacement installs as an update. Going back to ok-rn
         * means an ok-rn build with a versionCode above it.
         */
        applicationId System.getenv('OKEDGE_APP_ID') ?: 'com.okedge'
        def commits = 0
        try {
            commits = providers.exec { commandLine 'git', 'rev-list', '--count', 'HEAD' }.standardOutput.asText.get().trim().toInteger()
        } catch (Exception ignored) {
            logger.lifecycle("versionCode: no git history here, using 1000")
        }
        versionCode 1000 + commits
    }
    /*
     * ONE SIGNING KEY WITH OK-RN: ok-rn's repo debug.keystore (signing/debug.keystore, a copy), the
     * key its dev and pre-release builds carry - a replacement build must be signed by the same
     * certificate as the app it updates, or Android refuses it. Every ok-edge build uses it, not
     * the keystore expo prebuild generates.
     */
    signingConfigs {
        debug {
            storeFile file("$rootDir/../signing/debug.keystore")
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
}
`;

const withAppGradle = (config) => withAppBuildGradle(config, (c) => {
  if (!c.modResults.contents.includes('// okedge-native: the C++ staging path')) c.modResults.contents += APP_GRADLE;
  return c;
});

/*
 * OK-RN'S LOOK (Brad, 2026-10-21: "the launcher icon stuff and other assets"): ok-rn's own
 * resources, copied in app-res/ (same layout as res/), laid over what prebuild generates -
 *   the launcher icon: the white O on black, an adaptive vector icon (mipmap-anydpi-v26) and its
 *     Android 7 layer-list (mipmap-anydpi); anydpi wins over the density PNGs Expo writes
 *   the launch window: drawable/splash_window (the logo on splash_background #1a1a1a), made the
 *     window background of Expo's splash theme, as ok-rn's Theme.App.Main does
 *   the name the launcher shows: OnlyKey, ok-rn's app_name
 */
const fs = require('fs');
const { withDangerousMod, withAndroidStyles, withStringsXml } = require('expo/config-plugins');

const withOkRnLook = (config) => {
  config = withDangerousMod(config, ['android', async (c) => {
    const from = path.join(__dirname, 'app-res');
    const to = path.join(c.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res');
    for (const dir of fs.readdirSync(from)) {
      fs.mkdirSync(path.join(to, dir), { recursive: true });
      for (const f of fs.readdirSync(path.join(from, dir))) fs.copyFileSync(path.join(from, dir, f), path.join(to, dir, f));
    }
    return c;
  }]);
  config = withAndroidStyles(config, (c) => {
    const style = (c.modResults.resources.style || []).find((s) => s.$.name === 'Theme.App.SplashScreen');
    if (style) {
      const bg = style.item.find((i) => i.$.name === 'android:windowBackground');
      if (bg) bg._ = '@drawable/splash_window';
      else style.item.push({ $: { name: 'android:windowBackground' }, _: '@drawable/splash_window' });
    }
    return c;
  });
  return withStringsXml(config, (c) => {
    const row = (c.modResults.resources.string || []).find((s) => s.$.name === 'app_name');
    if (row) row._ = 'OnlyKey';
    return c;
  });
};

module.exports = (config) => withOkRnLook(withAppGradle(withActivityCalls(withAppCalls(withOkEmuProperties(withOkEmuProject(config))))));

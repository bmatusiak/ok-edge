/*
 * THE BANNERS UNDER THE STATUS BAR, each a plugin (PROPOSAL-rectify-ok-edge.md R0): it says when it shows and what it
 * says; MainApp draws whichever this platform's list registered (src/features/list.*.ts), in order, and names none.
 */
import React, {useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import OkEmu from '../transport/OkEmu';
import {Btn} from '../ui/components';
import {theme} from '../ui/theme';
import {buildInfo} from '../buildInfo';
import {appSignature} from '../appSignature';
import {TEST_BUILD_BANNER} from '../platform';
import {currentNet, onNet, type Net} from '../net';
import {onOtherTabs} from '../webTabs';
import {PRE} from '../ui/configModeNotes';
import type {AppBanner, BannerContext} from '../plugins/types';
import type {TabsService} from '../plugins/tabs';

type Register = (err: Error | null, services: Record<string, unknown>) => void;
function bannerPlugin(banner: AppBanner) {
  const setup = (imports: {tabs: TabsService}, register: Register) => {
    imports.tabs.banner(banner);
    register(null, {[`banner:${banner.name}`]: {}});
  };
  setup.consumes = ['tabs'];
  setup.provides = [`banner:${banner.name}`];
  return setup;
}

/* one banner's frame: the testing banner's shape, in its colour */
function Line({color = theme.warn, children}: {color?: string; children: React.ReactNode}) {
  return (
    <View style={[styles.box, {borderColor: color}]}>
      <Text style={[styles.text, {color}]}>{children}</Text>
    </View>
  );
}

/*
 * OPEN IN ANOTHER TAB TOO (Brad, 2026-10-29: "WARN the user with a banner about the multiple chrome tab windows open"):
 * the tabs ask one key and write one bucket on their own - said in every one while another is open (src/webTabs.ts).
 * The web app's list only.
 */
function OtherTabs() {
  const [n, setN] = useState(0);
  useEffect(() => onOtherTabs(setN), []);
  return n > 0 ? (
    <Line color={theme.error}>
      {`This app is open in ${n} other tab${n === 1 ? '' : 's'} - close ${n === 1 ? 'it' : 'them'}: tabs share one key and one bucket, and get in each other's way`}
    </Line>
  ) : null;
}
export const otherTabsBanner = bannerPlugin({name: 'other tabs', order: 10, render: () => <OtherTabs />});

/*
 * A TEST build made with OKRN_DEBUG_LOCK=off (Brad, 2026-10-05): the debugging lock is off, so a computer with adb could
 * approve and press. Said in red on every screen, so this build can never pass for a pre-release - release.js will not
 * package one from it anyway. adb is the phone's alone: elsewhere only the build's kind is said (TEST_BUILD_BANNER).
 */
export const testBuildBanner = bannerPlugin({
  name: 'test build', order: 20,
  render: () => (!buildInfo.debugLock ? <Line color={theme.error}>{TEST_BUILD_BANNER}</Line> : null),
});

/*
 * NOT SIGNED BY THE OFFICIAL RELEASE KEY (Brad, 2026-10-13: "if the app is not signed by the official release key, it
 * shows a banner like test build ... the banner will be called unofficial release"). A repackaged APK runs under someone
 * else's certificate; said in red on every screen, like the TEST BUILD banner (src/appSignature.ts).
 */
export const unofficialBanner = bannerPlugin({
  name: 'unofficial', order: 30,
  render: () => (appSignature.unofficial ? <Line color={theme.error}>UNOFFICIAL RELEASE - this app is not signed with the OnlyKey release key</Line> : null),
});

/*
 * THE TESTNET (BLOCKS.md §5; Brad, 2026-10-07): the soft key runs on its own storage slot - a throwaway key with its own
 * Edge chain. Said on every screen, so a testnet budget or block is never taken for a live one.
 */
function Testnet() {
  const [net, setNet] = useState<Net>(currentNet());
  useEffect(() => onNet(setNet), []);
  return net === 'test' ? <Line color={theme.io}>TESTNET - a throwaway soft key with its own Edge chain; nothing here is live</Line> : null;
}
export const testnetBanner = bannerPlugin({name: 'testnet', order: 40, render: () => <Testnet />});

/* TESTING MODE: `__DEV__` inline so Metro folds the branch out of a release bundle; Login Bypass while the soft key is locked */
export const testingBanner = bannerPlugin({
  name: 'testing', order: 50,
  render: ctx => (__DEV__ && ctx.testing ? (
    <View style={[styles.box, ctx.devLogin && styles.row]}>
      <Text style={[styles.text, ctx.devLogin && {flex: 1}]}>Testing mode — PIN bypassed, developer tools shown</Text>
      {ctx.devLogin ? <Btn title="Login Bypass" tone="primary" onPress={ctx.devLogin} /> : null}
    </View>
  ) : null),
});

/*
 * CONFIG MODE - TWO WORDS, and that is the point. The banner this replaces said the key would not sign or type and that
 * only a restart would end it. Neither is something an app flag knows, and saying it anyway is how the old one came to
 * describe a key nobody had touched. Consequences get added to this line as features are actually put behind the flag -
 * never in advance of them.
 */
export const configModeBanner = bannerPlugin({
  name: 'config mode', order: 60,
  render: ctx => (ctx.configMode >= PRE ? (
    <View style={styles.config}>
      <Text style={styles.configText}>Config mode</Text>
    </View>
  ) : null),
});

/*
 * THE SOFT KEY HALTING IS SAID ON EVERY TAB, not only on This Key. A two-second hold on button 3 is the firmware's lock
 * gesture, and on a real key it restarts the device; the emulator's thread only exits through the reset trap and cannot
 * be replaced in this process (FINDING-lock-gesture-ends-the-soft-key.md). Every other tab kept drawing its keypad over a
 * firmware that was gone, and a tap there did nothing with nothing said. The way back is an app restart, so that is
 * offered wherever the halt is seen - with a countdown at the login screen.
 */
const HALT_RESTART_SECONDS = 60;
function Halted({countdown}: {countdown: boolean}) {
  const [left, setLeft] = useState(HALT_RESTART_SECONDS);
  const [cancelled, setCancelled] = useState(false);
  const running = countdown && !cancelled;
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setLeft(s => s - 1), 1000);
    return () => clearInterval(timer);
  }, [running]);
  useEffect(() => {
    if (running && left <= 0) void OkEmu.restartApp();
  }, [running, left]);
  return (
    <View style={styles.box}>
      <Text style={styles.text}>
        The soft key has stopped — its firmware thread cannot be replaced
        in this process. Nothing is lost.
        {running ? ` Restarting the app in ${Math.max(left, 0)} s.` : ''}
      </Text>
      {countdown ? (
        <View style={styles.haltButtons}>
          <View style={styles.haltButton}>
            <Btn title="Restart now" tone="primary" onPress={() => OkEmu.restartApp()} />
          </View>
          {running ? (
            <View style={styles.haltButton}>
              <Btn title="Cancel" onPress={() => setCancelled(true)} />
            </View>
          ) : null}
        </View>
      ) : (
        <Btn title="Restart the app" tone="primary" onPress={() => OkEmu.restartApp()} />
      )}
    </View>
  );
}
export const haltedBanner = bannerPlugin({
  name: 'halted', order: 70,
  render: ctx => (ctx.halted ? <Halted countdown={ctx.atLogin} /> : null),
});

/* every platform's banners; the web app's list adds otherTabsBanner */
export const commonBanners = [testBuildBanner, unofficialBanner, testnetBanner, testingBanner, configModeBanner, haltedBanner];

const styles = StyleSheet.create({
  box: {
    marginHorizontal: 16,
    marginBottom: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.warn,
    backgroundColor: 'rgba(252, 211, 77, 0.10)',
  },
  text: {color: theme.warn, fontSize: 11, fontWeight: '600'},
  row: {flexDirection: 'row', alignItems: 'center', gap: 8},
  /* The testing banner's shape in the error colour, as it was before. */
  config: {
    marginHorizontal: 16,
    marginBottom: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.error,
  },
  configText: {color: theme.error, fontSize: 12, fontWeight: '600'},
  haltButtons: {flexDirection: 'row', gap: 8},
  haltButton: {flex: 1},
});

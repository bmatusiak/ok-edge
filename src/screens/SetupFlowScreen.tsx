/*
 * THE SETUP TAB (Brad, 2026-10-31: "lets create a real setup flow tab, it will replace the 'this key' setup flow - if a
 * key is uninitialized, it gives us the 'setup' tab instead of the 'this key' tab"; "the setup tab should not show this
 * current page directly, and the tab switcher between hard and soft keys should only exist on the first setup tab page
 * in the flow").
 *
 * One flow, wherever a blank key is met - the login's setup step (MainApp) and the Setup tab (features/core.tsx):
 *   1. which key: the Soft Key / Hard key row - here and nowhere else - READ-ONLY: a detected hard key always wins
 *      (useKey), the soft key otherwise; then Continue
 *   2. its PIN: the soft key's on-screen PIN (SetupScreen: the app presses it) or a hard key's PIN on its own buttons
 *      (HardKeySetupScreen: a prod hard key has nothing the app can press). Back returns to page 1.
 */
import React, {useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Logo} from '../ui/Logo';
import {Btn, Segmented} from '../ui/components';
import {theme} from '../ui/theme';
import {SOFT_KEY_HERE} from '../platform';
import type {KeyControl} from '../hooks/useKey';
import {SetupScreen} from './SetupScreen';
import {HardKeySetupScreen} from './HardKeySetupScreen';

/* the two keys, by the names they are called everywhere else in the app (Segmented renders the option itself) */
type KeyPick = 'Hard key' | 'Soft Key';
const PICK_OPTIONS: readonly KeyPick[] = ['Hard key', 'Soft Key'];

export function SetupFlowScreen({keys, onDone, onBack}: {
  keys: KeyControl;
  /** the PIN is set (the soft key unlocks with it; a hard key is unplugged and plugged back in) */
  onDone: () => void;
  /** off page 1: back where the flow was opened from (the login screen); none on the Setup tab */
  onBack?: () => void;
}) {
  const [page, setPage] = useState<'which' | 'pin'>('which');
  const emu = keys.key;
  const hard = keys.backend === 'usb';
  /* the picked key has no PIN yet (the other one may) */
  const blank = emu.device === 'uninitialized';
  /*
   * WHICH KEY, READ-ONLY (Brad, 2026-10-31: "hardkey always wins now ... the hardkey softkey selector becomes
   * readonly"): a detected hard key is the key (useKey backend), the soft key otherwise - the row shows which, and
   * takes no taps. Drawn where this platform has a soft key (the web app has only the hard key).
   */
  const keyShown: KeyPick | null = SOFT_KEY_HERE ? (hard ? 'Hard key' : 'Soft Key') : null;

  if (page === 'pin') {
    return hard ? (
      <HardKeySetupScreen onDone={onDone} onBack={() => setPage('which')} />
    ) : (
      <SetupScreen onDone={onDone} onBack={() => setPage('which')} model={emu.model} onProvision={emu.provision} led={emu.led} />
    );
  }

  return (
    <View style={styles.page}>
      <Logo height={44} />
      <Text style={styles.title}>Set up a key</Text>
      <Text style={styles.hint}>
        {hard
          ? 'The OnlyKey on USB is the key here - a hard key always wins over the soft key.'
          : "This app's soft key - plug in an OnlyKey to set that up instead."}
      </Text>
      {keyShown ? (
        <View style={styles.pick}>
          <Segmented options={PICK_OPTIONS} value={keyShown} readOnly />
        </View>
      ) : null}
      <Text style={styles.say}>
        {!blank
          ? 'This key already has a PIN - Continue to log in with it.'
          : hard
            ? "Its PIN goes in on the key's own buttons - the app never sees it."
            : 'You choose its PIN here, on the screen.'}
      </Text>
      <View style={styles.actions}>
        {/* a key picked here that already has a PIN has nothing to set up: back to the login with it */}
        <Btn title="Continue" tone="primary" onPress={() => (blank ? setPage('pin') : onDone())} />
        {onBack ? <Btn title="Back" onPress={onBack} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12},
  title: {color: theme.text, fontSize: 22, fontWeight: '700', marginTop: 12},
  hint: {color: theme.textDim, fontSize: 13, textAlign: 'center', maxWidth: 360},
  say: {color: theme.text, fontSize: 14, textAlign: 'center', maxWidth: 360, marginTop: 8},
  actions: {width: '100%', maxWidth: 320, gap: 10, marginTop: 12},
  pick: {marginTop: 8, width: '100%', maxWidth: 320},
});

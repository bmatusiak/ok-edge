/*
 * THE SETUP TAB (Brad, 2026-10-31: "lets create a real setup flow tab, it will replace the 'this key' setup flow - if a
 * key is uninitialized, it gives us the 'setup' tab instead of the 'this key' tab"; "the setup tab should not show this
 * current page directly"; "during setup, i need to do backup passphrase recovery, and restore a backup"; "i also want the
 * option to do 2nd profile and self destruct"; "can i have checkboxes on the first screen for this?").
 *
 * One flow, wherever a blank key is met - the login's setup step (MainApp) and the Setup tab (features/core.tsx):
 *   1. which key - READ-ONLY (a detected hard key always wins, useKey) - and checkboxes for the optional steps
 *   2. the PINs: the primary, then the ticked second-profile and self-destruct PINs - on screen for the soft key
 *      (SetupScreen: the app presses them), on its own buttons for a hard key (HardKeySetupScreen)
 *   3. the backup passphrase, then a restore, as ticked - SetupScreen's own pages, for either key: a key stays in its
 *      first-use config mode until it is unplugged, the only time it takes them without a config-mode press
 *   4. a hard key: unplug it and plug it back in (that ends config mode), then log in
 */
import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {Logo} from '../ui/Logo';
import {Btn, Segmented} from '../ui/components';
import {theme} from '../ui/theme';
import {SOFT_KEY_HERE} from '../platform';
import type {KeyControl} from '../hooks/useKey';
import {SetupScreen, type Kind, type SetupPlan} from './SetupScreen';
import {HardKeySetupScreen} from './HardKeySetupScreen';

/* the two keys, by the names they are called everywhere else in the app (Segmented renders the option itself) */
type KeyPick = 'Hard key' | 'Soft Key';
const PICK_OPTIONS: readonly KeyPick[] = ['Hard key', 'Soft Key'];

/* the optional steps, in the order they run */
type Optional = 'secondary' | 'selfDestruct' | 'passphrase' | 'restore';
const OPTIONS: ReadonlyArray<{id: Optional; label: string; note: string}> = [
  {id: 'secondary', label: 'Second profile PIN', note: 'a second PIN that opens a second set of slots'},
  {id: 'selfDestruct', label: 'Self-destruct PIN', note: 'a PIN that wipes the key when entered'},
  {id: 'passphrase', label: 'Backup passphrase', note: 'the passphrase backups of this key are encrypted with'},
  {id: 'restore', label: 'Restore a backup', note: 'make this key a copy of one you have: a backup file and its passphrase'},
];

function CheckRow({checked, label, note, onToggle}: {checked: boolean; label: string; note: string; onToggle: () => void}) {
  return (
    <Pressable onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{checked}} accessibilityLabel={label} style={styles.check}>
      <Text style={styles.box}>{checked ? '☑' : '☐'}</Text>
      <View style={styles.checkText}>
        <Text style={styles.checkLabel}>{label}</Text>
        <Text style={styles.checkNote}>{note}</Text>
      </View>
    </Pressable>
  );
}

export function SetupFlowScreen({keys, onDone, onBack}: {
  keys: KeyControl;
  /** the setup is finished (a hard key: unplugged and plugged back in) */
  onDone: () => void;
  /** off page 1: back where the flow was opened from (the login screen); none on the Setup tab */
  onBack?: () => void;
}) {
  const [page, setPage] = useState<'which' | 'pins' | 'after' | 'replug'>('which');
  const [ticked, setTicked] = useState<Record<Optional, boolean>>({secondary: false, selfDestruct: false, passphrase: false, restore: false});
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
  const plan: SetupPlan = {
    kinds: ['primary', ...(ticked.secondary ? ['secondary' as Kind] : []), ...(ticked.selfDestruct ? ['selfDestruct' as Kind] : [])],
    passphrase: ticked.passphrase,
    restore: ticked.restore,
  };
  const more = plan.passphrase || plan.restore;
  /* a hard key ends with its replug; the soft key is done when its last page is */
  const finish = () => (hard ? setPage('replug') : onDone());

  if (page === 'pins') {
    return hard ? (
      <HardKeySetupScreen kinds={plan.kinds} more={more} onDone={() => (more ? setPage('after') : onDone())} onBack={() => setPage('which')} />
    ) : (
      <SetupScreen plan={plan} onDone={onDone} onBack={() => setPage('which')} model={emu.model} onProvision={emu.provision} led={emu.led} />
    );
  }
  if (page === 'after') {
    /* the hard key's PINs are set: the same passphrase / restore pages the soft key's wizard runs */
    return <SetupScreen plan={plan} startAt={plan.passphrase ? 'passphrase' : 'restore'} onDone={finish} model={emu.model} onProvision={emu.provision} />;
  }
  if (page === 'replug') {
    return (
      <View style={styles.page}>
        <Logo height={44} />
        <Text style={styles.title}>Almost done</Text>
        <Text style={styles.say}>Unplug the key and plug it back in: it starts locked, and its PIN unlocks it.</Text>
        <View style={styles.actions}>
          <Btn title="Continue" tone="primary" onPress={onDone} />
        </View>
      </View>
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
      {blank ? (
        <>
          <Text style={styles.say}>
            {hard ? "Its PINs go in on the key's own buttons - the app never sees them." : 'You choose its PINs here, on the screen.'}
          </Text>
          <View style={styles.checks}>
            <Text style={styles.checkHead}>A PIN, and also:</Text>
            {OPTIONS.map(o => (
              <CheckRow key={o.id} checked={ticked[o.id]} label={o.label} note={o.note} onToggle={() => setTicked(t => ({...t, [o.id]: !t[o.id]}))} />
            ))}
          </View>
        </>
      ) : (
        <Text style={styles.say}>This key already has a PIN - Continue to log in with it.</Text>
      )}
      <View style={styles.actions}>
        {/* a key that already has a PIN has nothing to set up here: back to the login with it */}
        <Btn title="Continue" tone="primary" onPress={() => (blank ? setPage('pins') : onDone())} />
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
  checks: {width: '100%', maxWidth: 360, gap: 6, marginTop: 4},
  checkHead: {color: theme.textDim, fontSize: 12, marginBottom: 2},
  check: {flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6},
  box: {color: theme.text, fontSize: 20, lineHeight: 22},
  checkText: {flex: 1},
  checkLabel: {color: theme.text, fontSize: 14, fontWeight: '600'},
  checkNote: {color: theme.textDim, fontSize: 12},
});

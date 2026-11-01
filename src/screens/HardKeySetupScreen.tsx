/**
 * A BLANK HARD KEY'S PIN, PRESSED ON THE KEY (Brad, 2026-10-31: "for a prod key, you can't press buttons except
 * physically on the key"). SetupScreen collects a PIN on screen and has the SOFT key's presser type it in; a hard key
 * has nothing the app can press - a production build has no debug console - so its PIN goes in on its own buttons, as
 * the OnlyKey App's wizard does it.
 *
 * The same steps as the lib's `onlykey-js setpin` (cli/index.js COMMANDS.setpin), on the app's own device handle:
 * device.pinStep armed -> (the person presses the PIN) -> stored -> confirming -> (presses it again) -> matched ->
 * committed. The app never sees the digits; the key compares the two passes itself, so a mismatch is the key's answer.
 * "Done" is the person saying they have pressed it - the key answers each step only when it is asked.
 */
import React, {useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {getOnlyKey} from '../onlykey';
import {activeBackend} from '../hooks/KeyContext';
import {Logo} from '../ui/Logo';
import {Btn} from '../ui/components';
import {theme} from '../ui/theme';
import type {Kind} from './SetupScreen';
import {PressIcon} from '../ui/PressIcon';

/* each PIN's name on this page */
const NAME: Record<Kind, string> = {primary: 'PIN', secondary: 'second-profile PIN', selfDestruct: 'self-destruct PIN'};

type Stage = 'start' | 'first' | 'again' | 'working' | 'done' | 'error';

/*
 * onBack: back a page (Brad, 2026-10-31: "i need a back button on this page") - not while the key is asked.
 * kinds: the PINs the setup tab's checkboxes asked for, set one after another on the key's own buttons (primary first).
 * more: steps follow (backup passphrase / restore - the key stays in its first-use config mode until unplugged), so the
 * last PIN hands on instead of saying to unplug the key.
 */
export function HardKeySetupScreen({onDone, onBack, kinds = ['primary'], more = false}: {
  onDone: () => void;
  onBack?: () => void;
  kinds?: Kind[];
  more?: boolean;
}) {
  const [stage, setStage] = useState<Stage>('start');
  const [at, setAt] = useState(0);
  const kind = kinds[at] ?? 'primary';
  const last = at >= kinds.length - 1;
  const [error, setError] = useState<string | null>(null);

  const step = async (label: string, timeoutMs?: number) => {
    const {device} = await getOnlyKey(activeBackend());
    return device.pinStep(label, {kind, ...(timeoutMs ? {timeoutMs} : {})});
  };
  /* one or more steps, then the next stage; any refusal (a mismatch included) is said, and setup starts over */
  const run = (labels: Array<[string, number?]>, next: Stage) => {
    setStage('working');
    setError(null);
    void (async () => {
      try {
        for (const [label, t] of labels) await step(label, t);
        setStage(next);
      } catch (e: unknown) {
        setError(String((e as Error)?.message ?? e));
        setStage('error');
      }
    })();
  };

  return (
    <ScrollView contentContainerStyle={styles.centre}>
      <Logo height={44} />
      <Text style={styles.title}>{`Choose a ${NAME[kind]}`}</Text>
      <Text style={styles.hint}>
        On this key's own buttons: 7 to 10 presses. The app never sees it, and it cannot be recovered - there is no reset
        that keeps what is on the key.
      </Text>
      {stage === 'start' ? (
        <View style={styles.actions}>
          <Btn title="Start" tone="primary" onPress={() => run([['armed']], 'first')} />
        </View>
      ) : null}
      {stage === 'first' ? (
        <View style={styles.actions}>
          <PressIcon />
          <Text style={styles.say}>{`Press your new ${NAME[kind]} on the OnlyKey's buttons now: 7 to 10 presses.`}</Text>
          <Btn title="Done - I pressed it" tone="primary" onPress={() => run([['stored'], ['confirming']], 'again')} />
        </View>
      ) : null}
      {stage === 'again' ? (
        <View style={styles.actions}>
          <PressIcon />
          <Text style={styles.say}>{`Press the same ${NAME[kind]} on the OnlyKey again.`}</Text>
          <Btn title="Done - I pressed it again" tone="primary" onPress={() => run([['matched'], ['committed', 30000]], 'done')} />
        </View>
      ) : null}
      {stage === 'working' ? <Text style={styles.hint}>Asking the key…</Text> : null}
      {stage === 'done' ? (
        <View style={styles.actions}>
          <Text style={styles.say}>
            {!last || more
              ? `The ${NAME[kind]} is set.`
              : `The ${NAME[kind]} is set. Unplug the key and plug it back in: it starts locked, and the PIN unlocks it.`}
          </Text>
          <Btn title="Continue" tone="primary" onPress={() => (last ? onDone() : (setAt(at + 1), setStage('start')))} />
        </View>
      ) : null}
      {stage === 'error' ? (
        <View style={styles.actions}>
          <Text style={[styles.say, {color: theme.error}]}>{`The key did not take it: ${error}`}</Text>
          <Text style={styles.hint}>Two passes that differ are refused by the key itself. Nothing was set.</Text>
          <Btn title="Start over" onPress={() => setStage('start')} />
        </View>
      ) : null}
      {onBack && stage !== 'working' && stage !== 'done' ? (
        <View style={styles.actions}>
          <Btn title="Back" onPress={onBack} />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centre: {flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8},
  title: {color: theme.text, fontSize: 22, fontWeight: '700', marginTop: 24},
  hint: {color: theme.textDim, fontSize: 12, lineHeight: 18, textAlign: 'center', maxWidth: 320},
  say: {color: theme.text, fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 320},
  actions: {marginTop: 20, gap: 12, alignItems: 'center', width: '100%', maxWidth: 320},
});

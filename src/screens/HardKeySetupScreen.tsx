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

type Stage = 'start' | 'first' | 'again' | 'working' | 'done' | 'error';

export function HardKeySetupScreen({onDone}: {onDone: () => void}) {
  const [stage, setStage] = useState<Stage>('start');
  const [error, setError] = useState<string | null>(null);

  const step = async (label: string, timeoutMs?: number) => {
    const {device} = await getOnlyKey(activeBackend());
    return device.pinStep(label, {kind: 'primary', ...(timeoutMs ? {timeoutMs} : {})});
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
      <Text style={styles.title}>Choose a PIN</Text>
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
          <Text style={styles.say}>Press your new PIN on the OnlyKey's buttons now: 7 to 10 presses.</Text>
          <Btn title="Done - I pressed it" tone="primary" onPress={() => run([['stored'], ['confirming']], 'again')} />
        </View>
      ) : null}
      {stage === 'again' ? (
        <View style={styles.actions}>
          <Text style={styles.say}>Press the same PIN on the OnlyKey again.</Text>
          <Btn title="Done - I pressed it again" tone="primary" onPress={() => run([['matched'], ['committed', 30000]], 'done')} />
        </View>
      ) : null}
      {stage === 'working' ? <Text style={styles.hint}>Asking the key…</Text> : null}
      {stage === 'done' ? (
        <View style={styles.actions}>
          <Text style={styles.say}>The PIN is set. Unplug the key and plug it back in: it starts locked, and the PIN unlocks it.</Text>
          <Btn title="Continue" tone="primary" onPress={onDone} />
        </View>
      ) : null}
      {stage === 'error' ? (
        <View style={styles.actions}>
          <Text style={[styles.say, {color: theme.error}]}>{`The key did not take it: ${error}`}</Text>
          <Text style={styles.hint}>Two passes that differ are refused by the key itself. Nothing was set.</Text>
          <Btn title="Start over" onPress={() => setStage('start')} />
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

import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Section} from './components';
import {theme} from './theme';
import type {KeyControl} from '../hooks/useKey';

/**
 * Which key the app is talking to - READ-ONLY.
 *
 * TWO DEVICES, NEVER MERGED. The soft key and a hard key answer the same
 * protocol, so every other screen is the same code either way - but they hold
 * different secrets, and this says which one is being read.
 *
 * A DETECTED HARD KEY ALWAYS WINS, across the whole app (Brad, 2026-10-31:
 * "hardkey always wins now, if a hardkey gets detected, stop the softkey ... it
 * is across the whole app"; "the hardkey softkey selector becomes readonly").
 * useKey decides it in one place; the auto/manual setting and the Soft / Hard /
 * Off override that used to be here are gone - nothing here can beat it.
 */
export function KeySource({keys}: {keys: KeyControl}) {
  const {backend, attached, name} = keys;

  return (
    <Section title="Which key">
      <View style={styles.row}>
        <Text style={styles.active}>{name}</Text>
        <Text style={styles.dim}>
          {attached === null
            ? 'looking for a hard key…'
            : attached
              ? 'a hard key is attached'
              : 'no hard key attached'}
        </Text>
      </View>

      <Text style={styles.hint}>
        {backend === 'usb'
          ? /*
             * Three answers, because the probe is three-valued and each one
             * changes what the person should do with their finger.
             */
            keys.hard.canPress === true
            ? 'Reading a physical OnlyKey over USB. This is a developer build ' +
              'whose console takes presses from the app, so a keypad is drawn — ' +
              'its own buttons work too.'
            : keys.hard.canPress === false
              ? 'Reading a physical OnlyKey over USB. Its buttons are its own — the ' +
                'app does not draw a keypad for one.'
              : 'Reading a physical OnlyKey over USB. Asking whether its console ' +
                'takes presses from the app…'
          : 'Reading the soft key: the same firmware, running inside this app.'}
      </Text>
      <Text style={styles.hint}>
        A hard key, once detected, always wins: the soft key is stopped then, and
        comes back when the app restarts.
      </Text>
    </Section>
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4},
  active: {color: theme.text, fontSize: 16, fontWeight: '700', flex: 1},
  dim: {color: theme.textDim, fontSize: 12},
  hint: {color: theme.textDim, fontSize: 12, lineHeight: 18, marginTop: 6},
});

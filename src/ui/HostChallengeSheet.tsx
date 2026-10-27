/*
 * THE CODE TO ENTER ON A HARD KEY THIS APP ASKED (src/hostChallenge.ts), shown wherever the person is - a key that waits
 * for a code no screen shows only times out (Brad: "a sheet for every press"). The shared Sheet, so the system bars and
 * the backdrop are its business. It closes itself when the key answers or gives up; nothing to tap.
 */
import React, {useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Sheet} from './Sheet';
import {theme} from './theme';
import {hostChallenge, onHostChallenge, type HostChallenge} from '../hostChallenge';
import {activeBackend} from '../hooks/KeyContext';

export function HostChallengeSheet() {
  const [c, setC] = useState<HostChallenge | null>(hostChallenge());
  useEffect(() => onHostChallenge(setC), []);
  /* a hard key's only: the soft key's wait has its own sheet with its button (PressSheet, from the firmware's record) */
  if (!c || activeBackend() !== 'usb') return null;
  return (
    <Sheet title="Press the key">
      <Text style={styles.what}>{c.what}</Text>
      {c.digits.length ? (
        <>
          <Text style={styles.note}>On your OnlyKey, press these buttons in order:</Text>
          <View style={styles.digits}>
            {c.digits.map((d, i) => <Text key={i} style={styles.digit}>{d}</Text>)}
          </View>
          <Text style={styles.note}>A key set to ask for one press takes any button instead.</Text>
        </>
      ) : (
        <Text style={styles.note}>Press a button on your OnlyKey.</Text>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  what: {color: theme.text, fontSize: 15, marginBottom: 8},
  note: {color: theme.textDim, fontSize: 13, lineHeight: 18},
  digits: {flexDirection: 'row', gap: 16, justifyContent: 'center', marginVertical: 12},
  digit: {color: theme.text, fontSize: 34, fontWeight: '600', fontFamily: theme.mono},
});

/*
 * THE CODE TO ENTER ON A HARD KEY THIS APP ASKED (src/hostChallenge.ts), shown wherever the person is - a key that waits
 * for a code no screen shows only times out (Brad: "a sheet for every press"). The shared Sheet, so the system bars and
 * the backdrop are its business. It closes itself when the key answers or gives up; nothing to tap.
 */
import React, {useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Sheet} from './Sheet';
import {PressIcon} from './PressIcon';
import {usePressSound} from './pressSound';
import {theme} from './theme';
import {hostChallenge, onHostChallenge, type HostChallenge} from '../hostChallenge';
import {activeBackend} from '../hooks/KeyContext';

/*
 * THE KEY'S 20 SECONDS (Brad, 2026-10-31: "dont we have a press sheet with a timer for 20 seconds, i think thats the hold
 * up"; "need a timer on it"; "and sound"): the key gives up a press it waits for at 20 s (lib okcrypto, fadeoffafter20sec)
 * - the sheet counts them down from when it opened, as a thin line along its bottom (SheetCountdown, the idle bar's
 * look), and rings as every press sheet does (pressSound: soft at once, loud past 10 s).
 */
const KEY_WAIT_S = 20;

export function HostChallengeSheet() {
  const [c, setC] = useState<HostChallenge | null>(hostChallenge());
  useEffect(() => onHostChallenge(setC), []);
  /* when this wait began: a new challenge is a new wait */
  const [since, setSince] = useState<number | null>(null);
  useEffect(() => { setSince(c ? Date.now() : null); }, [c]);
  const hard = !!c && activeBackend() === 'usb';
  usePressSound(hard && since !== null ? since : null, 'press');
  /* a hard key's only: the soft key's wait has its own sheet with its button (PressSheet, from the firmware's record) */
  if (!c || !hard) return null;
  return (
    <Sheet tone="press" title="Press the key" countdown={since !== null ? {since, seconds: KEY_WAIT_S} : null}>
      <PressIcon />
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

/**
 * USED WITHOUT A PRESS (Brad, 2026-10-27: "if a silent press happens i want the sheet to play the sound once, and auto
 * close 15 seconds, and a dismiss button"). With the key's derive setting at None (field 30), the soft key answers a
 * derive - the bucket, the password list, anything touchless - without asking anyone. Its firmware still reports it
 * (key_chain's "silent" record, src/pressAsk.ts onSilentUse), whoever asked: this app, a computer over USB or
 * Bluetooth, the web app. So a silent use is never invisible: this sheet names what was opened, sounds once, and
 * closes itself 15 s after the last use - or at once with Dismiss. Uses close together share one sheet.
 *
 * A notice only: nothing waits on it, nothing is answered by it. A touch derive (a password) is never silent - the
 * firmware's press floor asks for it whatever field 30 says.
 */
import React, {useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Btn} from './components';
import {Sheet} from './Sheet';
import {theme} from './theme';
import {chimeOnce} from './pressSound';
import {deriveNameOf, onSilentUse, ownAskOf, startPressRecords, type SilentUse} from '../pressAsk';

const SHOWN_MS = 15_000;
/* the uses listed at most: a burst (a sync opening store after store) stays one short sheet */
const KEEP = 5;

const nameOf = (label: string) => deriveNameOf(label) ?? ownAskOf(label) ?? `A derived key (label ${label.slice(0, 16)}…)`;
const clock = (at: number) => new Date(at).toTimeString().slice(0, 8);

export function SilentUseSheet() {
  const [uses, setUses] = useState<(SilentUse & {what: string})[]>([]);
  useEffect(() => {
    startPressRecords();
    return onSilentUse(u => {
      /* named now: an own ask's name lasts only a short while (ownAskOf) */
      setUses(prev => [...prev, {...u, what: nameOf(u.label)}].slice(-KEEP));
      chimeOnce();
    });
  }, []);
  /* closes itself 15 s after the LAST use: a use that comes while it is up keeps it up */
  const last = uses.length ? uses[uses.length - 1].at : 0;
  useEffect(() => {
    if (!last) return;
    const t = setTimeout(() => setUses([]), SHOWN_MS);
    return () => clearTimeout(t);
  }, [last]);
  const dismiss = () => setUses([]);
  if (!uses.length) return null;

  return (
    <Sheet tone="edge" title="Used without a press" onClose={dismiss}>
      {uses.map((u, i) => (
        <View key={`${u.at}-${i}`} style={styles.row}>
          <Text style={styles.what}>{u.what}</Text>
          <Text style={styles.at}>{clock(u.at)}</Text>
        </View>
      ))}
      <Text style={styles.note}>
        The soft key answered by itself: its derive setting is None (Settings › Preferences › "Web and agent derived
        keys"). Passwords still ask for a press. This closes by itself in 15 seconds.
      </Text>
      <View style={styles.buttons}>
        <Btn title="Dismiss" tone="primary" onPress={dismiss} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 6},
  what: {color: theme.text, fontSize: 15, flex: 1},
  at: {color: theme.textDim, fontSize: 12, fontFamily: theme.mono},
  note: {color: theme.textDim, fontSize: 13, lineHeight: 18, marginTop: 6},
  buttons: {flexDirection: 'row', marginTop: 12},
});

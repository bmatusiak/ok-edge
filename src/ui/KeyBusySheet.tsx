/*
 * WAIT FOR THE KEY (src/keyBusy.ts): over whatever tab is open while the key works - through the WebAuthn tunnel (the
 * web app) or straight to it (the phone's soft key, a USB key) - what it is doing, a bar over the operation's steps, and,
 * over the tunnel, why the browser keeps showing its security-key window. Nothing to
 * tap: it goes away when the key is done. The shared Sheet, so the system bars and the backdrop are its business. The
 * code to enter has its own sheet (HostChallengeSheet), which this one steps aside for.
 */
import React, {useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Sheet} from './Sheet';
import {theme} from './theme';
import {keyBusy, onKeyBusy, type KeyBusy} from '../keyBusy';
import {hostChallenge, onHostChallenge, type HostChallenge} from '../hostChallenge';

export function KeyBusySheet() {
  const [b, setB] = useState<KeyBusy | null>(keyBusy());
  const [c, setC] = useState<HostChallenge | null>(hostChallenge());
  useEffect(() => onKeyBusy(setB), []);
  useEffect(() => onHostChallenge(setC), []);
  if (!b || c) return null;
  const pct = Math.min(100, Math.round((100 * b.step) / b.steps));
  /* the step in progress, counted from 1 (the bar fills by the steps done) */
  const counts = [`Step ${b.done ? b.steps : Math.min(b.step + 1, b.steps)} of ${b.steps}`];
  if (b.ops > 1) counts.push(`request ${b.ops}`);
  if (b.waiting) counts.push(`${b.waiting} more waiting`);
  return (
    <Sheet title={b.press && !b.done ? 'Press your OnlyKey' : 'Working with your key'}>
      <Text style={styles.what}>{b.done ? `${b.what} - done` : b.what}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, {width: `${pct}%`}]} />
      </View>
      <Text style={styles.counts}>{counts.join(' · ')}</Text>
      <Text style={styles.note}>
        {b.press && !b.done
          ? 'The key is waiting for you: press it to go on. The browser window that asks for your security key is part of this step.'
          : b.via === 'direct'
            ? 'This app is talking to your OnlyKey. Wait here until it is done.'
            : 'Each step is one security-key window from your browser - that is this app talking to your OnlyKey. Wait here until it is done.'}
      </Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  what: {color: theme.text, fontSize: 16, marginBottom: 12},
  track: {height: 8, borderRadius: 4, backgroundColor: theme.border, overflow: 'hidden'},
  fill: {height: 8, borderRadius: 4, backgroundColor: theme.accent},
  counts: {color: theme.textDim, fontSize: 13, marginTop: 8},
  note: {color: theme.textDim, fontSize: 13, marginTop: 12, lineHeight: 18},
});

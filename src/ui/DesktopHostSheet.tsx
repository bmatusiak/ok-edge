import React, {useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {Btn} from './components';
import {mmss, useSecondsLeft} from './EdgeRequestSheet';
import {Sheet} from './Sheet';
import {theme} from './theme';

/*
 * THE CLI'S REQUEST, ON THE DESKTOP (ok-edge TODO B4b): `onlykey-js` reaches the hard key through
 * this app (electron/desktop/hosting.js), and the CLI's own host asks the person here instead of on
 * the terminal - a budget to open, an agent identity to keep. Approve, then the press on the key
 * (it pulses yellow); Decline, or no answer in two minutes, is a no.
 *
 * THE COUNTDOWNS, as the phone's sheet shows them (Brad, 2026-10-24: "no 2min timer on the approve
 * this budget?"): "Answer within m:ss" until the host's deadline (red in the last minute), then
 * "Press within m:ss" for the hard key's 20 s press window (red in the last 15 s) - the same hook
 * and format as EdgeRequestSheet.
 *
 * Desktop only: it listens to the shell's okedge:host* events and is nothing anywhere else. A plain
 * first sheet - what the host says, the question, the two buttons; Brad designs the final one (B2).
 */

/* the hard key's press window: fadeoffafter20 in okcore.cpp */
const PRESS_MS = 20000;

type Ask = {id: number; net: string; lines: string[]; question: string; until?: number};
type Shell = {
  on(channel: string, listener: (payload: any) => void): () => void;
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
};

const shell = (globalThis as {okedge?: Shell}).okedge;

export function DesktopHostSheet() {
  const [ask, setAsk] = useState<Ask | null>(null);
  const [pressUntil, setPressUntil] = useState<number | null>(null);
  const [after, setAfter] = useState<string[]>([]);
  const answered = pressUntil !== null;
  const left = useSecondsLeft(ask ? (answered ? pressUntil : ask.until ?? null) : null);

  useEffect(() => {
    if (!shell) return undefined;
    const offs = [
      shell.on('okedge:hostAsk', (a: Ask) => { setAsk(a); setPressUntil(null); setAfter([]); }),
      /* after the answer: "PRESS the key now" and what follows */
      shell.on('okedge:hostSay', (p: {line: string}) => setAfter((x) => [...x, p.line])),
      shell.on('okedge:hostDone', () => { setAsk(null); setPressUntil(null); setAfter([]); }),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  if (!shell || !ask) return null;
  const answer = (yes: boolean) => {
    setAfter([]);
    shell.invoke('okedge:hostAnswer', ask.id, yes).catch(() => undefined);
    if (yes) setPressUntil(Date.now() + PRESS_MS);
    else setAsk(null);
  };
  const test = ask.net === 'test';
  return (
    <Sheet
      tone="edge"
      title={test ? 'onlykey-js asks - TESTNET' : 'onlykey-js asks'}
      footer={answered ? null : (
        <View style={styles.row}>
          <Btn title="Decline" onPress={() => answer(false)} />
          <Btn title="Approve" tone="primary" onPress={() => answer(true)} />
        </View>
      )}>
      {ask.lines.map((l, i) => <Text key={i} style={styles.line}>{l}</Text>)}
      {answered ? null : <Text style={styles.question}>{ask.question}</Text>}
      {!answered && left !== null ? (
        <Text style={[styles.countdown, left <= 60 && {color: theme.error}]}>{`Answer within ${mmss(left)}`}</Text>
      ) : null}
      {after.map((l, i) => <Text key={i} style={styles.press}>{l}</Text>)}
      {answered && left !== null ? (
        <Text style={[styles.countdown, left <= 15 && {color: theme.error}]}>{`Press within ${mmss(left)}`}</Text>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: 'row', justifyContent: 'flex-end', gap: 12},
  line: {color: theme.text, fontFamily: 'monospace', fontSize: 13, marginBottom: 4},
  question: {color: theme.text, fontSize: 16, fontWeight: '600', marginTop: 12},
  countdown: {color: theme.warn, fontSize: 14, fontWeight: '600', marginTop: 6},
  press: {color: theme.warn, fontSize: 16, fontWeight: '700', marginTop: 12},
});

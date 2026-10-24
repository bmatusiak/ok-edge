import React, {useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {Btn} from './components';
import {Sheet} from './Sheet';
import {theme} from './theme';

/*
 * THE CLI'S REQUEST, ON THE DESKTOP (ok-edge TODO B4b): `onlykey-js` reaches the hard key through
 * this app (electron/desktop/hosting.js), and the CLI's own host asks the person here instead of on
 * the terminal - a budget to open, an agent identity to keep. Approve, then the press on the key
 * (it pulses yellow); Decline, or no answer in two minutes, is a no.
 *
 * Desktop only: it listens to the shell's okedge:host* events and is nothing anywhere else. A plain
 * first sheet - what the host says, the question, the two buttons; Brad designs the final one (B2).
 */

type Ask = {id: number; net: string; lines: string[]; question: string};
type Shell = {
  on(channel: string, listener: (payload: any) => void): () => void;
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
};

const shell = (globalThis as {okedge?: Shell}).okedge;

export function DesktopHostSheet() {
  const [ask, setAsk] = useState<Ask | null>(null);
  const [answered, setAnswered] = useState(false);
  const [after, setAfter] = useState<string[]>([]);

  useEffect(() => {
    if (!shell) return undefined;
    const offs = [
      shell.on('okedge:hostAsk', (a: Ask) => { setAsk(a); setAnswered(false); setAfter([]); }),
      /* after the answer: "PRESS the key now" and what follows */
      shell.on('okedge:hostSay', (p: {line: string}) => setAfter((x) => [...x, p.line])),
      shell.on('okedge:hostDone', () => { setAsk(null); setAnswered(false); setAfter([]); }),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  if (!shell || !ask) return null;
  const answer = (yes: boolean) => {
    setAnswered(true);
    setAfter([]);
    shell.invoke('okedge:hostAnswer', ask.id, yes).catch(() => undefined);
    if (!yes) setAsk(null);
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
      {after.map((l, i) => <Text key={i} style={styles.press}>{l}</Text>)}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: 'row', justifyContent: 'flex-end', gap: 12},
  line: {color: theme.text, fontFamily: 'monospace', fontSize: 13, marginBottom: 4},
  question: {color: theme.text, fontSize: 16, fontWeight: '600', marginTop: 12},
  press: {color: theme.warn, fontSize: 16, fontWeight: '700', marginTop: 12},
});

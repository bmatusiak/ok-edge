import React, {useCallback, useEffect, useState} from 'react';
import {StyleSheet, Text, TextInput, View} from 'react-native';

import {Btn, Section} from './components';
import {theme} from './theme';
import {desktop} from '../platform';

/*
 * "MY DEVICE NAME" FOR THE HARD KEY, in the Edge Management drawer (Brad, 2026-10-24: "i should be able
 * to set the nametag for key1 and change it too, and the desktop app i should be able to set it in the
 * edge manage popup tab"). The main process calls the lib's nametag.js - the same function as
 * `onlykey-js edge name`: the key signs its owner statement over this device and the name (no press), it
 * is checked, and kept in the key's identity records, so every device of yours shows it the same.
 * The wording and the 64-character limit follow the phone's own card (YourDevicesCard).
 */

type Answer = {deviceId?: string; net?: string; nametag?: string | null; at?: number | null; others?: {deviceId: string; nametag: string}[]; error?: string};

export function HardKeyNameCard() {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!desktop) return;
    const a = (await desktop.invoke('okedge:hardKeyName').catch((e) => ({error: String((e as Error)?.message ?? e)}))) as Answer;
    setAnswer(a);
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (!desktop) return null;
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = (await desktop!.invoke('okedge:hardKeySetName', draft.trim())) as Answer;
      if (r.error) setError(r.error);
      else { setDraft(''); await load(); }
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section title="This key's nametag">
      <Text style={styles.dim}>A name or a tag your other devices will see for this key.</Text>
      {answer?.error ? <Text style={styles.error}>{`Could not read the key: ${answer.error}`}</Text> : null}
      {answer && !answer.error ? (
        <Text style={styles.current}>
          {answer.nametag ? `"${answer.nametag}"` : 'No name yet'}
          <Text style={styles.dim}>{`  · device ${answer.deviceId?.slice(0, 16)}${answer.net === 'test' ? ' · TESTNET' : ''}`}</Text>
        </Text>
      ) : null}
      <TextInput
        style={styles.input}
        value={draft}
        onChangeText={setDraft}
        placeholder={answer?.nametag || 'a name or a tag'}
        placeholderTextColor={theme.textDim}
        maxLength={64}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.row}>
        <Btn title={busy ? 'Saving…' : answer?.nametag ? 'Change' : 'Save'} tone="primary" disabled={!draft.trim() || busy} onPress={() => { void save(); }} />
      </View>
      {(answer?.others || []).length ? (
        <View style={styles.others}>
          <Text style={styles.dim}>Other devices of this key:</Text>
          {answer!.others!.map((o) => <Text key={o.deviceId} style={styles.other}>{`${o.deviceId.slice(0, 16)}  "${o.nametag}"`}</Text>)}
        </View>
      ) : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  dim: {color: theme.textDim, fontSize: 13},
  current: {color: theme.text, fontSize: 15, fontWeight: '600', marginTop: 8},
  error: {color: theme.error, fontSize: 13, marginTop: 6},
  input: {color: theme.text, borderWidth: 1, borderColor: theme.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginTop: 8},
  row: {flexDirection: 'row', gap: 8, marginTop: 8},
  others: {marginTop: 10, gap: 2},
  other: {color: theme.text, fontSize: 12, fontFamily: 'monospace'},
});

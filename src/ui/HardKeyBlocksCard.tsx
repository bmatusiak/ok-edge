import React, {useCallback, useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {Btn, Section} from './components';
import {theme} from './theme';
import {desktop} from '../platform';

/*
 * BLOCKS FOR THE HARD KEY, in the Edge Management drawer (Brad, 2026-10-24: "what else is missing in
 * edge management tab"): the key's chain copy cut at its seals - the lib's copy.blocks, the same as
 * `onlykey-js edge blocks` - each block's range, its links and whether it verifies, and how many links
 * are after the last seal. Read from the key's identity records only (hosting.js), never the key.
 */

type Block = {from: number; to: number; links: number; id: string; ok: boolean; reason: string | null};
type Answer = {devices?: {deviceId: string; open: number; reason: string | null; blocks: Block[]}[]; error?: string};

export function HardKeyBlocksCard() {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const load = useCallback(async () => {
    if (!desktop) return;
    setAnswer((await desktop.invoke('okedge:hardKeyBlocks').catch((e) => ({error: String((e as Error)?.message ?? e)}))) as Answer);
  }, []);
  useEffect(() => { void load(); }, [load]);
  if (!desktop) return null;
  return (
    <Section title="Blocks">
      <Text style={styles.dim}>
        The chain as JSON blocks: one per closed budget, each sealed by the key. Anyone can check them with SHA-256 and this key&apos;s public key.
      </Text>
      {answer?.error ? <Text style={styles.error}>{`Could not read: ${answer.error}`}</Text> : null}
      {answer?.devices?.length === 0 ? <Text style={styles.dim}>No copy of this key&apos;s chain yet - a budget through onlykey-js starts one.</Text> : null}
      {answer?.devices?.map((d) => (
        <View key={d.deviceId} style={styles.device}>
          <Text style={styles.head}>{`Device ${d.deviceId.slice(0, 16)} · ${d.blocks.length} block(s), ${d.open} link(s) after the last seal${d.reason ? ` - ${d.reason}` : ''}`}</Text>
          {d.blocks.map((b) => (
            <Text key={b.id} style={b.ok ? styles.block : styles.bad}>
              {`#${b.from}-#${b.to}  ${b.links} link(s)  ${b.ok ? 'verified' : `does not verify: ${b.reason}`}  ${b.id.slice(0, 16)}`}
            </Text>
          ))}
        </View>
      ))}
      <View style={styles.row}><Btn title="Refresh" onPress={() => void load()} /></View>
    </Section>
  );
}

const styles = StyleSheet.create({
  dim: {color: theme.textDim, fontSize: 13},
  error: {color: theme.error, fontSize: 13, marginTop: 6},
  device: {marginTop: 8, gap: 2},
  head: {color: theme.text, fontSize: 13, fontWeight: '600'},
  block: {color: theme.text, fontSize: 12, fontFamily: 'monospace'},
  bad: {color: theme.error, fontSize: 12, fontFamily: 'monospace'},
  row: {flexDirection: 'row', gap: 8, marginTop: 8},
});

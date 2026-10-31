/**
 * AGENT IDENTITIES in the Edge Management drawer (src/agentIdentities.ts; Brad, 2026-10-30: "rename Agent identity to a
 * plural multi identity section, like nametag ... so a agent can pick from a list"). One row per certified identity in
 * the identity bucket: its label, status (usable, expired, revoked - archived, never deleted), its derivation labels,
 * the certificate's fingerprint and dates. Revoke takes a press. Nothing is renamed: a label is fixed once certified.
 *
 * The identity kept the old way (edgeIdentity.ts, set by `onlykey-js edge setup`) is shown below the list until it is
 * certified into it - "Certify as a card" keeps its certificate, so the gpg fingerprint stays the same.
 */
import React, {useCallback, useEffect, useState} from 'react';
import {StyleSheet, Text, TextInput, View} from 'react-native';
import {identity as identityLib} from 'node-onlykey-lib/edge';
import {loadKept, onIdentity, type KeptIdentity} from '../edgeIdentity';
import {certifyKeptIdentity, loadAgents, onAgentsChanged, revokeAgent, type AgentRow} from '../agentIdentities';
import {DrawerArea} from './BottomDrawer';
import {Btn} from './components';
import {theme} from './theme';

const day = (s: number) => new Date(s * 1000).toISOString().slice(0, 10);
const STATUS_COLOR: Record<AgentRow['status'], string> = {usable: theme.ok, expired: theme.warn, revoked: theme.textDim, unverified: theme.error};

export function AgentIdentityCard() {
  const [rows, setRows] = useState<AgentRow[] | null | undefined>(undefined);
  const [kept, setKept] = useState<KeptIdentity | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const load = useCallback(async () => {
    setRows(await loadAgents().catch(() => null));
    setKept(await loadKept().catch(() => null));
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => onAgentsChanged(() => { void load(); }), [load]);
  useEffect(() => onIdentity(() => { void load(); }), [load]);

  /* the kept identity's labels already certified into the list: nothing more to offer */
  const keptListed = !!kept && (rows ?? []).some(r => r.entry?.card?.thing?.derive?.ssh === kept.record.ssh && r.entry?.card?.thing?.derive?.gpg === kept.record.gpgUid);
  const run = async (what: string, fn: () => Promise<unknown>) => {
    setBusy(what);
    setError(null);
    try { await fn(); } catch (e: unknown) { setError(String((e as Error)?.message ?? e)); } finally { setBusy(null); void load(); }
  };

  if (rows === undefined) return null;
  return (
    <DrawerArea>
      <Text style={styles.name}>Agent identities</Text>
      {rows === null ? <Text style={styles.dim}>Shown once the bucket is open and the key gives its owner keys.</Text> : null}
      {rows && !rows.length ? <Text style={styles.dim}>None certified yet. An agent picks one of these by its label.</Text> : null}
      {(rows ?? []).map(r => {
        const t = r.entry?.card?.thing;
        const fp = r.entry?.certs?.gpg?.fingerprint;
        return (
          <View key={r.label} style={styles.item}>
            <View style={styles.head}>
              <Text style={styles.label}>{r.label}</Text>
              <Text style={[styles.status, {color: STATUS_COLOR[r.status]}]}>{r.status}</Text>
            </View>
            {t?.derive?.ssh ? <Text style={styles.line} selectable>{t.derive.ssh}</Text> : null}
            {t?.derive?.gpg ? <Text style={styles.line} selectable>{`gpg ${t.derive.gpg}`}</Text> : null}
            {fp ? <Text style={styles.dim} selectable>{identityLib.spacedFingerprint(fp)}</Text> : null}
            {r.created ? <Text style={styles.dim}>{`made ${day(r.created)} · expires ${r.expires ? day(r.created + r.expires) : 'never'}`}</Text> : null}
            {r.status === 'usable' ? (
              <View style={styles.row}><Btn title={busy === r.label ? 'Press the key…' : 'Revoke…'} disabled={!!busy} onPress={() => { void run(r.label, () => revokeAgent(r.label)); }} /></View>
            ) : null}
          </View>
        );
      })}
      {kept && !keptListed ? (
        <View style={styles.item}>
          <Text style={styles.dim}>The identity kept here from `onlykey-js edge setup` - not in the list yet:</Text>
          {identityLib.rows(kept.record).map(([k, v]: [string, string]) => <Text key={k} style={styles.line}>{`${k}  ${v}`}</Text>)}
          <TextInput style={styles.input} value={label} onChangeText={setLabel} placeholder="its label, e.g. nitro16 claude" placeholderTextColor={theme.textDim} maxLength={64} />
          <View style={styles.row}>
            <Btn title={busy === 'kept' ? 'Press the key…' : 'Certify as a card'} tone="primary" disabled={!!busy || !label.trim()} onPress={() => { void run('kept', () => certifyKeptIdentity(label.trim())); }} />
          </View>
          <Text style={styles.dim}>Its certificate is kept, so its gpg fingerprint stays the same. The label cannot change afterwards.</Text>
        </View>
      ) : null}
      {error ? <Text style={[styles.line, {color: theme.error}]}>{error}</Text> : null}
    </DrawerArea>
  );
}

const styles = StyleSheet.create({
  name: {color: theme.text, fontWeight: '600', fontSize: 15},
  item: {paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border},
  head: {flexDirection: 'row', justifyContent: 'space-between'},
  label: {color: theme.text, fontWeight: '600', fontSize: 14},
  status: {fontSize: 13},
  line: {color: theme.text, fontSize: 13},
  dim: {color: theme.textDim, fontSize: 13, lineHeight: 19},
  row: {flexDirection: 'row', gap: 10, marginTop: 6},
  input: {color: theme.text, borderWidth: 1, borderColor: theme.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, marginTop: 6},
});

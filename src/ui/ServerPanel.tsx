/*
 * THE SYNC TAB'S SERVER PANEL (Brad, 2026-10-26: "sync tab needs a panel for this"): the user's server this device
 * meets its other devices on (src/serverRoom.ts). One code on every shell: the phone and the desktop are given the
 * address here; the web app's is the page's own server, shown, not asked.
 *
 * Shows whether this device is in its identity's room, the other devices there now, and the last trade it started.
 */
import React, {useEffect, useState} from 'react';
import {StyleSheet, Text, TextInput, View} from 'react-native';
import {Btn, Section} from './components';
import {theme} from './theme';
import {shell} from '../platform';
import {joinServerRoom, onRoomState, retryServerRoom, roomState, serverUrl, setServerUrl, type RoomState} from '../serverRoom';

const KIND: Record<string, string> = {webapp: 'web app', android: 'phone', desktop: 'desktop', cli: 'computer (CLI)', agent: 'agent'};

function statusText(s: RoomState): string {
  if (!s.url) {
    if (shell === 'webapp' && s.site) return `This page is ${location.host.split(":")[0]}, not your key's site ${s.site} - nothing syncs here. Open https://${s.site}.`;
    if (!s.site) return "Your key names no server (ctap_bridge off, or no site set) - this device syncs only with the devices paired to it.";
    return 'No server - this device syncs only with the devices paired to it.';
  }
  if (s.status === 'joined') return `In this key's room on ${new URL(s.url).host}.`;
  if (s.status === 'joining') return `Joining ${new URL(s.url).host}…`;
  if (s.status === 'error') return `Not joined: ${s.why ?? 'unknown'}`;
  return `${new URL(s.url).host} - joined once the bucket is open.`;
}

export function ServerPanel() {
  const [s, setS] = useState<RoomState>(roomState());
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => onRoomState(setS), []);
  useEffect(() => {
    void serverUrl().then(u => { setDraft(u ?? ''); if (u && !roomState().url) void joinServerRoom(); });
  }, []);
  const editable = shell !== 'webapp';
  const save = async (url: string | null) => {
    setError(null);
    try { await setServerUrl(url); } catch (e) { setError(String((e as Error)?.message ?? e)); }
  };

  return (
    <Section title="Server">
      {/* the key names its server (ctap_bridge's site, read at the identity check) */}
      <Text style={styles.note}>{s.site ? `Your key's server: ${s.site}` : "Your key names no server."}</Text>
      {editable ? (
        <View style={styles.row}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="testing only: another server (e.g. a local one)"
            placeholderTextColor={theme.textDim}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <Btn title={s.url && draft.trim() === s.url ? 'Leave' : 'Join'} disabled={!draft.trim() && !s.url}
            onPress={() => void save(s.url && draft.trim() === s.url ? null : draft.trim() || null)} />
        </View>
      ) : (
        <Text style={styles.name}>{s.url ? new URL(s.url).host : ''} <Text style={styles.note}>(this page's server)</Text></Text>
      )}
      {error ? <Text style={styles.warn}>{error}</Text> : null}
      <Text style={s.status === 'joined' ? styles.on : styles.note}>{statusText(s)}</Text>
      {/* a failure that needs the key is tried again only from here, never on a timer (serverRoom.ts) */}
      {s.status === 'error' && s.needsKey ? <Btn title="Try again" onPress={retryServerRoom} /> : null}
      {s.status === 'joined' ? (
        <View style={styles.list}>
          {s.you ? <Text style={styles.peer}>{s.you.name} <Text style={styles.note}>- this device</Text></Text> : null}
          {s.peers.length ? s.peers.map(p => (
            <Text key={p.id} style={styles.peer}>{p.name} <Text style={styles.note}>- {KIND[p.kind] ?? p.kind}</Text></Text>
          )) : <Text style={styles.note}>No other device of this key is online.</Text>}
        </View>
      ) : null}
      {s.last ? <Text style={styles.note}>{`Last trade, with ${s.last.with}: ${s.last.line}`}</Text> : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6},
  input: {flex: 1, color: theme.text, borderColor: theme.border, borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, fontSize: 13},
  name: {color: theme.text, fontSize: 14, marginBottom: 4},
  on: {color: theme.ok, fontSize: 13, marginBottom: 6},
  note: {color: theme.textDim, fontSize: 12, lineHeight: 17},
  warn: {color: theme.warn, fontSize: 12, lineHeight: 17, marginVertical: 4},
  list: {marginVertical: 4, gap: 2},
  peer: {color: theme.text, fontSize: 13},
});

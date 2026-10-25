/*
 * THE SYNC TAB (Brad, 2026-10-25): the 🔁 in the top bar leads here, on the phone and the desktop alike. It says what
 * the sync service is doing and lists the paired devices it syncs with; a new one is paired here, no CLI needed.
 *
 *   - The desktop HOSTS the service while it runs (electron/desktop/sync.js): it reaches the phones it is cli-paired
 *     with and trades this computer's bucket with them whenever it changes, and on a slow timer.
 *   - The phone is reached: a paired computer's service trades with it while the app is open and its Bluetooth API is
 *     on (src/bucketTrade.ts answers).
 */
import React from 'react';
import {ScrollView, StyleSheet, Switch, Text, View} from 'react-native';
import {Section} from '../ui/components';
import {PairedDevicesCard} from '../ui/PairedDevicesCard';
import {theme} from '../ui/theme';
import {pairGate, sync, useSync, type SyncState} from '../sync';

const SERVICE_TEXT: Record<SyncState['service'], string> = {
  'off': 'Waiting - it starts once the key is unlocked and its bucket is open.',
  'no-peers': 'Waiting - no phone is paired with this computer yet.',
  'running': 'Running - this computer\'s bucket is synced with the phones below.',
  'stopped': 'Not reaching a phone right now - trying again in a minute.',
};

function when(at: number): string {
  const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return new Date(at).toLocaleString();
}

export function SyncScreen({testing = false}: {testing?: boolean}) {
  const state = useSync();
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.page}>
      <Section title="Sync service">
        {state ? (
          <>
            <View style={styles.row}>
              <Text style={styles.name}>Sync this computer's bucket</Text>
              <Switch value={state.enabled} onValueChange={on => void sync.setEnabled(on)} />
            </View>
            <Text style={state.service === 'running' ? styles.on : styles.note}>
              {state.enabled ? SERVICE_TEXT[state.service] : 'Turned off - nothing is synced until it is turned on.'}
            </Text>
            {state.net ? <Text style={styles.note}>Net: {state.net === 'test' ? 'testnet' : 'live'}</Text> : null}
            <Text style={styles.note}>
              {state.last ? `Last sync ${when(state.last.at)}: ${state.last.line.replace(/^(edge: )?sync:\s*/, '')}` : 'No sync yet.'}
            </Text>
            {testing && state.lines.length ? (
              <Text style={styles.mono}>{state.lines.slice(-8).join('\n')}</Text>
            ) : null}
          </>
        ) : (
          <Text style={styles.note}>
            A paired computer syncs its bucket with this phone whenever it reaches it - while the app is open, with the
            Bluetooth API on.
          </Text>
        )}
      </Section>
      {pairGate ? <PairedDevicesCard gate={pairGate} testing={testing} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  /* the Bluetooth tab's own page (BluetoothScreen.tsx) */
  root: {flex: 1},
  page: {padding: 16, gap: 16, paddingBottom: 48},
  on: {color: theme.ok, fontSize: 13, marginBottom: 6},
  row: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6},
  name: {color: theme.text, fontSize: 14},
  note: {color: theme.textDim, fontSize: 12, lineHeight: 17, marginVertical: 2},
  mono: {fontFamily: theme.mono, color: theme.textSecondary, fontSize: 11, marginTop: 6},
});

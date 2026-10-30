/*
 * THE SYNC TAB, ONE CODE ON THE PHONE AND THE DESKTOP (Brad, 2026-10-25: "the whole idea of using this platform style
 * is to use identical code, so the bugs are fixed in 1 spot"). The desktop's ⇄ in the top bar leads here; the phone's
 * Bluetooth tab has a button to it.
 *
 *   - Server: the user's server this device meets its other devices on (src/ui/ServerPanel.tsx) - the web app has
 *     only this (no Bluetooth, no cli pair), with Identity and Features.
 *   - Sync service: the switch, what the service is doing, the last sync.
 *   - Features: each store in the bucket - its items, whether it matches the other device, when it was last checked
 *     and last changed by a sync ("a panel that shows the status of each feature, and last sync timestamps").
 *   - Paired devices: the cli pair, the same card on both sides (src/ui/PairedDevicesCard.tsx).
 * Where the state comes from is src/sync.ts's business; the words follow the side (the phone is reached, the computer
 * reaches).
 */
import React, {useEffect, useState} from 'react';
import {ScrollView, StyleSheet, Switch, Text, View} from 'react-native';
import {Btn, Section} from '../ui/components';
import {IdentityCard, type IdentityRow} from '../ui/IdentityCard';
import {PairedDevicesCard} from '../ui/PairedDevicesCard';
import {ServerPanel} from '../ui/ServerPanel';
import {shell} from '../platform';
import {theme} from '../ui/theme';
import {bucketSummary, openBucketIdentity} from '../bucketStore';
import {activeBackend} from '../hooks/KeyContext';
import {readKeyIdentity, useKeyIdentity} from '../keyIdentity';
import {netTag} from '../net';
import {pairGate, sync, useSync, type SyncState, type SyncStore} from '../sync';

function serviceText(s: SyncState): string {
  const phone = s.role === 'phone';
  switch (s.service) {
    case 'off': return 'Waiting - it starts once the key is unlocked and its bucket is open.';
    case 'no-peers': return phone ? 'Waiting - no computer is paired with this phone yet.' : 'Waiting - no phone is paired with this computer yet.';
    case 'running': return phone
      ? 'Running - the paired computers below sync this phone\'s bucket whenever they reach it (the app open, its Bluetooth API on).'
      : 'Running - this computer\'s bucket is synced with the phones below.';
    case 'stopped': return 'Not reaching a phone right now - trying again in a minute.';
    case 'elsewhere': return `Another sync service on this computer has it - one per computer${s.elsewhere ? ` (${s.elsewhere})` : ''}.`;
    default: return '';
  }
}

/* a store's name, in the app's words (a testnet store is the same feature) */
const FEATURE: Record<string, string> = {passwords: 'Passwords', guestbook: 'Guest Book', keychain: 'Key Chain', cryptobox: 'Cryptobox'};
const featureName = (store: string) => FEATURE[store.replace(/-test$/, '')] ?? store;

function when(at: number | null | undefined): string {
  if (!at) return 'never';
  const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(at).toLocaleString();
}

function FeatureRow({name, s}: {name: string; s: SyncStore}) {
  const mark = s.same === null ? '?' : s.same ? '✓' : '≠';
  const color = s.same === null ? theme.textDim : s.same ? theme.ok : theme.warn;
  return (
    <View style={styles.feature}>
      <Text style={[styles.mark, {color}]}>{mark}</Text>
      <View style={styles.featureText}>
        <Text style={styles.name}>{featureName(name)}</Text>
        <Text style={styles.sub}>
          {s.same === null
            ? `${s.items} item${s.items === 1 ? '' : 's'} here · not compared with another device yet`
            : `${s.items} item${s.items === 1 ? '' : 's'} · ${s.same ? 'in sync' : 'differs'} · checked ${when(s.checkedAt)} · changed by a sync ${when(s.changedAt)}`}
        </Text>
      </View>
    </View>
  );
}

/*
 * IDENTITY (Brad, 2026-10-25: "a new panel called identity, so we can see it if it goes past identity check
 * automatically" - on the Sync tab): what the identity check read from the key, beside whose bucket is open - a sync
 * trades only between devices of one identity, and the two must be the same. "Read again" asks the key now.
 */
function IdentityPanel() {
  const read = useKeyIdentity();
  const [reading, setReading] = useState(false);
  const open = openBucketIdentity();
  const keyName = activeBackend() === 'usb' ? 'Hard Key' : 'Soft Key';
  const differs = read?.kind === 'read' && open && open.identity !== read.identity;
  const rows: IdentityRow[] = [
    {label: 'key', value: keyName},
    {label: 'chain', value: netTag() ? 'testnet' : 'live'},
    {label: 'bucket identity', value: read?.kind === 'read' ? read.identity : read ? 'could not read' : 'not read yet'},
    {label: 'open bucket', value: open ? `${open.identity} (${open.kind === 'kept' ? 'kept on this computer' : 'sealed'})` : 'none open', warn: !!differs},
    ...(read?.kind === 'read' && read.edgeIdentity ? [{label: 'this device', value: read.nametag ? `"${read.nametag}"` : 'UNNAMED - set its nametag in Edge Management'}] : []),
    ...(read ? [{label: 'read', value: when(read.at)}] : []),
  ];
  return (
    <Section title="Identity">
      <IdentityCard wide rows={rows} checking={reading} />
      {differs ? <Text style={styles.warn}>The open bucket is not this key's identity - unlock again to open this key's own.</Text> : null}
      {read?.kind === 'none' ? <Text style={styles.note}>{read.why}</Text> : null}
      <Btn title={reading ? 'Reading…' : 'Read again'} disabled={reading} onPress={() => { setReading(true); void readKeyIdentity().finally(() => setReading(false)); }} />
    </Section>
  );
}

export function SyncScreen({testing = false}: {testing?: boolean}) {
  const state = useSync();
  /*
   * EACH FEATURE AS THIS DEVICE HOLDS IT, always (Brad: "it should show the status of itself") - its items from the
   * bucket open here; a sync check adds whether it matches the other device, and when. Read again after each change.
   */
  const [own, setOwn] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    let live = true;
    void bucketSummary().then(s => { if (live) setOwn(s); }).catch(() => {});
    return () => { live = false; };
  }, [state?.stores, state?.took?.at]);
  const merged: Record<string, SyncStore> = {};
  for (const [name, items] of Object.entries(own ?? {})) merged[name] = {items, same: null, checkedAt: 0, changedAt: null};
  for (const [name, s] of Object.entries(state?.stores ?? {})) merged[name] = {...s, items: own?.[name] ?? s.items};
  const stores = Object.entries(merged).sort(([a], [b]) => featureName(a).localeCompare(featureName(b)));
  const features = (
    <Section title="Features">
      {stores.length ? (
        stores.map(([name, s]) => <FeatureRow key={name} name={name} s={s} />)
      ) : (
        <Text style={styles.note}>No bucket is open on this device.</Text>
      )}
    </Section>
  );
  /* THE WEB APP HAS NO SYNC SERVICE (no Bluetooth, no cli pair): it syncs through its server alone */
  if (!state || shell === 'webapp') {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.page}>
        <IdentityPanel />
        <ServerPanel />
        {features}
      </ScrollView>
    );
  }
  const device = state.role === 'phone' ? 'phone' : 'computer';
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.page}>
      <IdentityPanel />
      <ServerPanel />
      <Section title="Sync service">
        <View style={styles.row}>
          <Text style={styles.name}>{`Sync this ${device}'s bucket`}</Text>
          <Switch value={state.enabled} onValueChange={on => void sync.setEnabled(on)} />
        </View>
        <Text style={state.enabled && state.service === 'running' ? styles.on : styles.note}>
          {state.enabled ? serviceText(state) : 'Turned off - nothing is synced until it is turned on.'}
        </Text>
        {state.net ? <Text style={styles.note}>Net: {state.net === 'test' ? 'testnet' : 'live'}</Text> : null}
        <Text style={styles.note}>
          {state.last ? `Last sync ${when(state.last.at)}: ${state.last.line.replace(/^(edge: )?sync:\s*/, '')}` : 'No sync yet.'}
        </Text>
        {testing && state.lines.length ? <Text style={styles.mono}>{state.lines.slice(-8).join('\n')}</Text> : null}
      </Section>

      {features}

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
  sub: {color: theme.textDim, fontSize: 11},
  note: {color: theme.textDim, fontSize: 12, lineHeight: 17, marginVertical: 2},
  mono: {fontFamily: theme.mono, color: theme.textSecondary, fontSize: 11, marginTop: 6},
  warn: {color: theme.warn, fontSize: 12, lineHeight: 17, marginVertical: 6},
  feature: {flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8},
  featureText: {flex: 1},
  mark: {fontSize: 16, width: 18, textAlign: 'center'},
});

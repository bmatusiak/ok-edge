/*
 * THE SYNC TAB, ONE CODE ON EVERY SHELL (Brad, 2026-10-25: "the whole idea of using this platform style is to use
 * identical code, so the bugs are fixed in 1 spot"). The 🔗's Activity card leads here.
 *
 *   - Identity: what the identity check read from the key, beside whose bucket is open.
 *   - Server: the user's server this device meets its other devices on (src/ui/ServerPanel.tsx) - its room is THE
 *     sync (Brad, 2026-10-30: "just remove ble pair and sync stuff - we are using key3 to push and sync, so phones are
 *     free to become testing over mcp until we rework how ble comes back"). The Sync service section (the desktop's
 *     Bluetooth service, the phone's switch) and the Paired devices card (the cli pair) went with it.
 *   - Features: each store in the bucket - its items, whether it matches the other device, when it was last checked
 *     and last changed by a sync ("a panel that shows the status of each feature, and last sync timestamps"), from the
 *     room's trades (src/serverRoom.ts).
 */
import React, {useEffect, useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {Btn, Section} from '../ui/components';
import {IdentityCard, type IdentityRow} from '../ui/IdentityCard';
import {ServerPanel} from '../ui/ServerPanel';
import {theme} from '../ui/theme';
import {bucketSummary, openBucketIdentity} from '../bucketStore';
import {activeBackend} from '../hooks/KeyContext';
import {useRoom} from '../hooks/useRoom';
import {readKeyIdentity, useKeyIdentity} from '../keyIdentity';
import {netTag} from '../net';
import type {SyncStore} from '../serverRoom';

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

export function SyncScreen() {
  const room = useRoom();
  /*
   * EACH FEATURE AS THIS DEVICE HOLDS IT, always (Brad: "it should show the status of itself") - its items from the
   * bucket open here; a trade in the room adds whether it matches the other device, and when. Read again after each.
   */
  const [own, setOwn] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    let live = true;
    void bucketSummary().then(s => { if (live) setOwn(s); }).catch(() => {});
    return () => { live = false; };
  }, [room.stores]);
  const merged: Record<string, SyncStore> = {};
  for (const [name, items] of Object.entries(own ?? {})) merged[name] = {items, same: null, checkedAt: 0, changedAt: null};
  for (const [name, s] of Object.entries(room.stores)) merged[name] = {...s, items: own?.[name] ?? s.items};
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
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.page}>
      <IdentityPanel />
      <ServerPanel />
      {features}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  /* the Bluetooth tab's own page (BluetoothScreen.tsx) */
  root: {flex: 1},
  page: {padding: 16, gap: 16, paddingBottom: 48},
  name: {color: theme.text, fontSize: 14},
  sub: {color: theme.textDim, fontSize: 11},
  note: {color: theme.textDim, fontSize: 12, lineHeight: 17, marginVertical: 2},
  warn: {color: theme.warn, fontSize: 12, lineHeight: 17, marginVertical: 6},
  feature: {flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8},
  featureText: {flex: 1},
  mark: {fontSize: 16, width: 18, textAlign: 'center'},
});

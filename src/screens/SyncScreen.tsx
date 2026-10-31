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
import type {RoomState, SyncStore} from '../serverRoom';

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

/*
 * EACH FEATURE AGAINST THE MCP SERVER, and only that (Brad, 2026-10-30: "can it show that it has been synced to the mcp?
 * so i know whats remote"; "no device comparing, just mcp comparing"): its items here, and the last round with the
 * server's sealed copy (serverRoom RoomState.sealed) - on the server ✓; not checked or a round running ?; changed here and
 * not sent yet (stale), or not synced, ≠.
 */
function serverLine(name: string, items: number, sealed: RoomState['sealed']): {line: string; mark: '✓' | '?' | '≠'} {
  if (sealed.status === 'unknown') return {line: 'not checked with the MCP server yet', mark: '?'};
  /* changed here after the last round: the server's copy of it is stale until the next round sends it */
  if (sealed.stale.includes(name)) return {line: `changed here · ${sealed.status === 'syncing' ? 'syncing with' : 'waiting to sync with'} the MCP server${sealed.at ? ` (it last had it ${when(sealed.at)})` : ''}`, mark: '≠'};
  /* the reverse: another device changed it on the server - older here until the round takes it */
  if (sealed.newer.includes(name)) return {line: `newer on the MCP server · ${sealed.status === 'syncing' ? 'taking it now' : 'waiting to take it'}`, mark: '≠'};
  if (sealed.status === 'syncing') return {line: 'syncing with the MCP server…', mark: '?'};
  if (sealed.status === 'none') return {line: 'the MCP server keeps no copy for this identity (a server from before every identity synced)', mark: '≠'};
  if (sealed.status === 'error') return {line: `not synced with the MCP server - ${sealed.why ?? 'the last round failed'} (${when(sealed.at)})`, mark: '≠'};
  const x = sealed.stores[name];
  if (!x || !items) return {line: 'not on the MCP server', mark: '≠'};
  const parts = (n: number) => `${n} part${n === 1 ? '' : 's'}`;
  const moved = [x.put ? `sent ${parts(x.put)}` : '', x.got ? `took ${parts(x.got)}` : ''].filter(Boolean).join(', ');
  return {line: `on the MCP server · checked ${when(sealed.at)}${moved ? ` · ${moved}` : ''}`, mark: '✓'};
}

function FeatureRow({name, s, sealed}: {name: string; s: SyncStore; sealed: RoomState['sealed']}) {
  const server = serverLine(name, s.items, sealed);
  const color = server.mark === '✓' ? theme.ok : server.mark === '?' ? theme.textDim : theme.warn;
  return (
    <View style={styles.feature}>
      <Text style={[styles.mark, {color}]}>{server.mark}</Text>
      <View style={styles.featureText}>
        <Text style={styles.name}>{featureName(name)}</Text>
        <Text style={styles.sub}>{`${s.items} item${s.items === 1 ? '' : 's'} here · ${server.line}`}</Text>
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
   * bucket open here, beside the MCP server's copy (FeatureRow). Read again after each trade or round with the server.
   */
  const [own, setOwn] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    let live = true;
    void bucketSummary().then(s => { if (live) setOwn(s); }).catch(() => {});
    return () => { live = false; };
  }, [room.stores, room.sealed]);
  const merged: Record<string, SyncStore> = {};
  for (const [name, items] of Object.entries(own ?? {})) merged[name] = {items, same: null, checkedAt: 0, changedAt: null};
  for (const [name, s] of Object.entries(room.stores)) merged[name] = {...s, items: own?.[name] ?? s.items};
  const stores = Object.entries(merged).sort(([a], [b]) => featureName(a).localeCompare(featureName(b)));
  const features = (
    <Section title="Features">
      {stores.length ? (
        stores.map(([name, s]) => <FeatureRow key={name} name={name} s={s} sealed={room.sealed} />)
      ) : (
        <Text style={styles.note}>No bucket is open on this device.</Text>
      )}
      {/* the copy's tier (Brad, 2026-10-30: "1 free (temp 7 day) and the lifetime (ones i choose)") */}
      {room.sealed.tier ? (
        <Text style={styles.note}>{room.sealed.tier.tier === 'lifetime'
          ? 'The MCP server keeps this copy for good (lifetime).'
          : `Free tier: the MCP server keeps this copy until ${room.sealed.tier.purgeAt ? new Date(room.sealed.tier.purgeAt).toLocaleString() : 'a week after the last sync'} - each sync moves that a week on.`}</Text>
      ) : null}
      {/* units new on the server that this device cannot name until it fetches them (their ids are keyed) */}
      {room.sealed.newerUnknown ? <Text style={styles.note}>{`${room.sealed.newerUnknown} new item${room.sealed.newerUnknown === 1 ? '' : 's'} on the MCP server, not here yet`}</Text> : null}
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

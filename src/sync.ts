/*
 * THE SYNC SERVICE, AS THE PAGE SEES IT - ONE STATE, BOTH SHELLS (Brad, 2026-10-25: "this service is a sync service";
 * "the whole idea of using this platform style is to use identical code, so the bugs are fixed in 1 spot").
 *
 * The Sync tab (src/screens/SyncScreen.tsx) and its Paired devices card (src/ui/PairedDevicesCard.tsx) are one code on
 * the phone and the desktop; what differs is only where this state comes from:
 *   - THE DESKTOP hosts the lib's sync service while it runs (electron/desktop/sync.js, `onlykey-js --service`): it
 *     reaches the phones it is cli-paired with and trades this computer's bucket with them; its state arrives here as
 *     the host's events.
 *   - THE PHONE answers a paired computer's trades (src/bucketTrade.ts): each check and trade it answers is reported
 *     here (phoneSync*), so the same state - switch, status, last sync, each feature - is the phone's own.
 * A shell with neither (the web app) gets null and shows no Sync tab.
 */
import {useEffect, useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {IO_SHOW_MS, IO_STEP_MS, ioPulse} from './btActivity';
import {btTransit, type PairingView} from './btTransit';
import {bucketTraded} from './bucketEvents';
import type {Net} from './net';
import {shell} from './platform';
import type {PairGate} from './ui/PairedDevicesCard';

/** A device this computer is cli-paired with - its public facts only (the pair secret never reaches the page). */
export type SyncPeer = {
  name: string | null;
  address: string | null;
  phoneId: string | null;
  renewedAt: number | null;
  /* the code shown at pairing; when this computer last synced with it; off: left alone */
  code?: string | null;
  lastUsed?: number | null;
  on?: boolean;
};

/** One feature's store, after the latest check: its items, whether it matches the other device, and when. */
export type SyncStore = {items: number; same: boolean | null; checkedAt: number; changedAt: number | null};

export type SyncState = {
  /* which side: the phone answers computers, the computer reaches phones (the words on the tab follow it) */
  role: 'phone' | 'computer';
  /* the person's switch on the Sync tab ("sync can be disabled") */
  enabled: boolean;
  /* off: turned off, or the app is locked; no-peers: nothing paired to sync with; running; stopped: ended, tried again later */
  service: 'off' | 'no-peers' | 'running' | 'stopped' | 'elsewhere';
  /* elsewhere: who runs this computer's sync service instead (a terminal `onlykey-js --service`) */
  elsewhere?: string;
  net: Net | null;
  /* the last sync, when, and whether it reached the other device */
  last: {line: string; at: number; ok: boolean} | null;
  /* a sync in progress: the desktop's ⇄ flashes */
  trading: boolean;
  /* each feature's store after the latest check (bucket store names: passwords, guestbook, keychain-test, ...) */
  stores?: Record<string, SyncStore>;
  /* the stores this side's last sync took changes into, and when (screens with a decrypted copy ask again) */
  took?: {stores: string[]; at: number} | null;
  /* the latest run's lines (the service, or a pairing) - shown in testing mode */
  lines: string[];
  pair: {running: boolean; code: string | null; line: string | null; ok: boolean | null; startedAt: number; codeAt: number | null} | null;
  peers: SyncPeer[];
};

type Bridge = {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
  on: (event: string, cb: (payload: never) => void) => () => void;
};

/* the desktop's preload (electron/preload.js) */
const bridge = shell === 'desktop' ? (globalThis as {okedge?: Bridge}).okedge ?? null : null;

/** Whether this shell hosts a sync service (the desktop's ⇄ in the top bar shows only there). */
export const syncHosted = bridge !== null;

const ask = (channel: string, ...args: unknown[]) =>
  (bridge ? (bridge.invoke(channel, ...args) as Promise<SyncState>) : Promise.resolve(null));

/*
 * The latest state, kept here for the whole page: the card's gate reads it synchronously (pairing()), the hook
 * re-renders on it. Kept current by events, never polled.
 */
let latest: SyncState | null = null;
const listeners = new Set<() => void>();
/*
 * TRANSMITTING = A PURPLE FLASH (Brad, 2026-10-25), the Bluetooth icons' own (src/btActivity.ts): while a sync is in
 * progress the 'sync' channel is pulsed, each pulse showing about a second, so the flash lasts as long as the sync.
 */
let pulsing: ReturnType<typeof setInterval> | null = null;
function take(s: SyncState) {
  /* a sync took changes in since the last state: say which stores (src/bucketEvents.ts - Passwords' banner) */
  if (s.took && s.took.at !== latest?.took?.at && latest) bucketTraded(s.took.stores);
  latest = s;
  if (s.trading && !pulsing) { ioPulse('sync'); pulsing = setInterval(() => ioPulse('sync'), IO_SHOW_MS - IO_STEP_MS); }
  if (!s.trading && pulsing) { clearInterval(pulsing); pulsing = null; }
  for (const l of [...listeners]) l();
}
if (bridge) {
  bridge.on('okedge:syncChanged', (s: SyncState) => take(s));
  void ask('okedge:syncState').then(s => { if (s && !latest) take(s); }).catch(() => {});
}

/*
 * THE PHONE'S OWN STATE: its switch (kept), whether its bucket is open, and what its trade handler reports. Its paired
 * computers are the card's (btTransit), so peers stays empty here.
 */
const PHONE_SWITCH = 'okedge.sync.enabled';
const phone = shell === 'android';
let phoneNet: Net | null = null;
function phoneState(next: Partial<SyncState>) {
  const base: SyncState = latest ?? {role: 'phone', enabled: true, service: 'off', net: null, last: null, trading: false, lines: [], pair: null, peers: []};
  const s = {...base, ...next};
  s.service = !s.enabled || !phoneNet ? 'off' : 'running';
  s.net = phoneNet;
  take(s);
}
if (phone) {
  phoneState({});
  void AsyncStorage.getItem(PHONE_SWITCH).then(v => { if (v === 'off') phoneState({enabled: false}); }).catch(() => {});
}
const keepLine = (line: string) => [...(latest?.lines ?? []), line].slice(-40);

/** The phone: may it answer a computer's trade now (switched on, bucket open)? */
export function phoneSyncAllowed(): boolean {
  return !!latest && latest.enabled && latest.service === 'running';
}
/** The phone answered a check: the two states, and each feature's store as it is here. */
export function phoneSyncChecked(same: boolean, stores: Record<string, {items: number; same: boolean}>) {
  const at = Date.now();
  const prev = latest?.stores ?? {};
  const next: Record<string, SyncStore> = {};
  for (const [name, s] of Object.entries(stores)) next[name] = {items: s.items, same: s.same, checkedAt: at, changedAt: prev[name]?.changedAt ?? null};
  const line = same ? 'sync: in sync (a paired computer checked)' : `sync: trading - ${Object.keys(stores).filter(n => !stores[n].same).join(', ')} differ`;
  phoneState({stores: next, trading: !same, lines: keepLine(line), ...(same ? {last: {line, at, ok: true}} : {})});
}
/**
 * The phone took a computer's records in: which stores, how many. `items`: each store's count after the take - a store
 * this device did not have yet (a blank web app, the box 2026-10-27: "changed by a sync never" beside 19 items it had
 * just been given) is listed from it.
 */
export function phoneSyncTraded(taken: Record<string, number>, items: Record<string, number> = {}) {
  const at = Date.now();
  const changed = Object.keys(taken).filter(k => Number(taken[k]) > 0);
  const stores = {...(latest?.stores ?? {})};
  for (const name of changed) {
    stores[name] = stores[name]
      ? {...stores[name], ...(items[name] !== undefined ? {items: items[name]} : {}), changedAt: at, same: true}
      : {items: items[name] ?? Number(taken[name]), same: true, checkedAt: at, changedAt: at};
  }
  const n = changed.reduce((a, k) => a + Number(taken[k]), 0);
  const line = `sync: traded with a paired computer - took ${n}`;
  phoneState({stores, trading: false, last: {line, at, ok: true}, lines: keepLine(line), ...(changed.length ? {took: {stores: changed, at}} : {})});
}

export const sync = {
  /** The app's net once its bucket is open, or null when it locks: the service runs for that net only. */
  setNet: (net: Net | null) => {
    if (phone) { phoneNet = net; phoneState({}); return Promise.resolve(latest); }
    return ask('okedge:syncNet', net);
  },
  /** The Sync tab's switch: off stops syncing until it is turned on again (kept across app starts). */
  setEnabled: (on: boolean) => {
    if (phone) {
      void AsyncStorage.setItem(PHONE_SWITCH, on ? 'on' : 'off').catch(() => {});
      phoneState({enabled: on});
      return Promise.resolve(latest);
    }
    return ask('okedge:syncEnable', on);
  },
  /** Pair a new phone (the cli-pair 6-digit flow); the code shows in the state, to compare with the phone's. */
  pair: () => ask('okedge:syncPair'),
  cancelPair: () => ask('okedge:syncPairCancel'),
  /** Forget a paired phone on this computer (the phone forgets this computer on its own Sync tab). */
  forget: (address: string) => ask('okedge:syncForget', address),
  /** Switch a paired phone on or off on this computer (off: the sync service leaves it alone). */
  setOn: (address: string, on: boolean) => ask('okedge:syncSetOn', address, on),
};

/** The sync state, or null on a shell with no sync (the web app). */
export function useSync(): SyncState | null {
  const [state, setState] = useState<SyncState | null>(latest);
  useEffect(() => {
    const l = () => setState(latest);
    listeners.add(l);
    l();
    return () => { listeners.delete(l); };
  }, []);
  return state;
}

/* how long each half of the computer's pairing waits (node-onlykey-lib cli/clipair-store.js pairOverPipe) */
const FIND_PHONE_MS = 120_000;
const APPROVE_MS = 150_000;

/*
 * THE COMPUTER'S SIDE OF THE CLI PAIR, for the card (src/ui/PairedDevicesCard.tsx): the phones this computer reaches,
 * from the host - with the phone side's own row facts (the pairing code, last used, on/off). Its pairing is the host's
 * `onlykey-js --ble pair` run, shown in the phone's stages.
 */
const computerGate: PairGate = {
  role: 'computer',
  list: async () => (latest?.peers ?? []).map(p => ({
    id: p.address ?? p.phoneId ?? '?',
    name: p.name ?? p.address ?? 'a phone',
    code: p.code ?? null,
    lastUsed: p.lastUsed ?? null,
    on: p.on !== false,
    renewedAt: p.renewedAt ?? null,
  })),
  pairing(): PairingView {
    const p = latest?.pair;
    if (!p) return {stage: 'closed'};
    if (p.running && !p.code) return {stage: 'waiting', until: p.startedAt + FIND_PHONE_MS};
    if (p.running && p.code) return {stage: 'code', until: (p.codeAt ?? p.startedAt) + APPROVE_MS, code: p.code, name: 'the phone', address: ''};
    if (p.ok) {
      /* the newest pairing is the one just made */
      const newest = [...(latest?.peers ?? [])].sort((a, b) => (b.renewedAt ?? 0) - (a.renewedAt ?? 0))[0];
      return {stage: 'paired', code: p.code ?? '', name: newest?.name ?? newest?.address ?? 'the phone'};
    }
    if (p.ok === false) return {stage: 'failed', reason: (p.line ?? 'the pairing ended').replace(/^onlykey-js:\s*/, '')};
    return {stage: 'closed'};
  },
  subscribe(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  openPairWindow() { void sync.pair(); },
  closePairWindow() { if (latest?.pair?.running) void sync.cancelPair(); },
  revoke: (id) => sync.forget(id),
  setOn: (id, on) => sync.setOn(id, on),
};

/*
 * THE PHONE'S SIDE: the computers it answers (src/btTransit.ts), the same gate the Bluetooth tab used before Sync had
 * its own tab.
 */
const phoneGate: PairGate = {
  role: 'phone',
  list: async () => (await btTransit.list()).map(c => ({id: c.id, name: c.name, code: c.code, lastUsed: c.lastUsed, on: c.on, renewedAt: c.renewedAt})),
  pairing: () => btTransit.pairing(),
  subscribe: (fn) => btTransit.subscribe(fn),
  openPairWindow: () => { btTransit.openPairWindow(); },
  closePairWindow: () => btTransit.closePairWindow(),
  approvePairing: () => btTransit.approvePairing(),
  revoke: (id) => btTransit.revoke(id),
  setOn: (id, on) => btTransit.setOn(id, on),
  notices: () => btTransit.notices(),
  clearNotices: () => btTransit.clearNotices(),
  transitOff: () => btTransit.transitOff(),
  setTransitOff: (v) => btTransit.setTransitOff(v),
  ageForTest: (id, ms) => btTransit.ageForTest(id, ms),
};

/** This shell's side of the cli pair: the phone answers computers, the desktop reaches phones; the web has none. */
export const pairGate: PairGate | null = shell === 'android' ? phoneGate : syncHosted ? computerGate : null;

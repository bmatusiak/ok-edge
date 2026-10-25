/*
 * THE SYNC SERVICE, AS THE PAGE SEES IT (Brad, 2026-10-25: "this service is a sync service"; the 🔁 in the top bar
 * leads to the Sync tab - its paired devices, and pairing a new phone "without cli").
 *
 * The service is the lib's (node-onlykey-lib bucket/cli/service.js): this computer's buckets watched and traded with
 * the devices it is cli-paired with. On the desktop the app hosts it while it runs (electron/desktop/sync.js); this
 * file is the page's one way to it, so the tab and the icon are shell-blind and the phone can host the same later
 * without the screen changing. A shell that hosts no sync service gets null, and shows neither.
 */
import {useEffect, useState} from 'react';
import {IO_SHOW_MS, IO_STEP_MS, ioPulse} from './btActivity';
import {btTransit, type PairingView} from './btTransit';
import {bucketTraded} from './bucketEvents';
import type {Net} from './net';
import {shell} from './platform';
import type {PairGate} from './ui/PairedDevicesCard';

/** A device this computer is cli-paired with - its public facts only (the pair secret never reaches the page). */
export type SyncPeer = {name: string | null; address: string | null; phoneId: string | null; renewedAt: number | null};

export type SyncState = {
  /* the person's switch on the Sync tab ("sync can be disabled") */
  enabled: boolean;
  /* off: turned off, or the app is locked; no-peers: nothing paired to sync with; running; stopped: ended, tried again later */
  service: 'off' | 'no-peers' | 'running' | 'stopped';
  net: Net | null;
  /* the service's last sync line, when, and whether it reached the phone */
  last: {line: string; at: number; ok: boolean} | null;
  /* a sync in progress: the 🔁 flashes */
  trading: boolean;
  /* the stores this computer's last sync took changes into, and when (screens with a decrypted copy ask again) */
  took?: {stores: string[]; at: number} | null;
  /* the latest run's lines (the service, or a pairing) */
  lines: string[];
  pair: {running: boolean; code: string | null; line: string | null; ok: boolean | null; startedAt: number; codeAt: number | null} | null;
  peers: SyncPeer[];
};

type Bridge = {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
  on: (event: string, cb: (payload: never) => void) => () => void;
};

/* the desktop's preload (electron/preload.js); no other shell hosts the service yet */
const bridge = shell === 'electron' ? (globalThis as {okedge?: Bridge}).okedge ?? null : null;

/** Whether this shell hosts a sync service (the 🔁 and the Sync tab show only where it does). */
export const syncHosted = bridge !== null;

const ask = (channel: string, ...args: unknown[]) =>
  (bridge ? (bridge.invoke(channel, ...args) as Promise<SyncState>) : Promise.resolve(null));

export const sync = {
  /** The app's net once its bucket is open, or null when it locks: the service runs for that net only. */
  setNet: (net: Net | null) => ask('okedge:syncNet', net),
  /** The Sync tab's switch: off stops the service until it is turned on again (kept across app starts). */
  setEnabled: (on: boolean) => ask('okedge:syncEnable', on),
  /** Pair a new phone (the cli-pair 6-digit flow); the code shows in the state, to compare with the phone's. */
  pair: () => ask('okedge:syncPair'),
  cancelPair: () => ask('okedge:syncPairCancel'),
  /** Forget a paired phone on this computer (the phone forgets this computer on its own Bluetooth tab). */
  forget: (address: string) => ask('okedge:syncForget', address),
};

/*
 * The host's latest state, kept here for the whole page: the card's gate reads it synchronously (pairing()), the hook
 * re-renders on it. Kept current by the host's own events, never polled.
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

/** The sync service's state, or null on a shell that hosts none. */
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
 * from the host. Its pairing is the host's `onlykey-js --ble pair` run, shown in the phone's stages.
 */
const computerGate: PairGate = {
  role: 'computer',
  list: async () => (latest?.peers ?? []).map(p => ({
    id: p.address ?? p.phoneId ?? '?',
    name: p.name ?? p.address ?? 'a phone',
    renewedAt: p.renewedAt,
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
};

/*
 * THE PHONE'S SIDE: the computers it answers (src/btTransit.ts), the same gate the Bluetooth tab used before Sync had
 * its own tab.
 */
const phoneGate: PairGate = {
  role: 'phone',
  list: async () => (await btTransit.list()).map(c => ({id: c.id, name: c.name, code: c.code, lastUsed: c.lastUsed, on: c.on})),
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

/*
 * THIS IDENTITY'S BUCKET, opened by the key (Brad, 2026-10-24: after the identity check's Continue, "a button
 * press here is needed to decrypt the container").
 *
 * One bucket per identity per net, held IN MEMORY ON EVERY PLATFORM while it is open, and kept by this platform's storage
 * (src/bucket/storage.*.ts - PROPOSAL-rectify-ok-edge.md R1): sealed rows on the phone (AsyncStorage) and in the web app
 * (IndexedDB), the CLI's shared file on the desktop. This file names no platform: what differs is the storage file the
 * build picked. Before R1 the desktop alone had no bucket in memory (every read and write crossed to the main process
 * key by key), so a "door" kind was checked in nearly every function here, and nothing that works on a bucket - a trade,
 * the server's sealed copy - could run on the desktop.
 *
 * Sealed rows are opened with A KEY THE ONLYKEY DERIVES (PROPOSAL-derived-keys.md, Brad 2026-10-27; firmware plugin
 * derive_secret): okcrypto.deriveSecret("okedge/bucket/v2/<identity>") under the site the key names (bucketKey, below),
 * the touchless key - 32 bytes in one request, protected by the key's derive setting (field 30: the code by default).
 * The rows opening with it and naming this identity is the proof the key is the identity's (lib plugins/identity
 * proveByRows); with nothing kept yet, the key signs a fresh challenge with the identity's key first, so a device that
 * only repeats someone's public key cannot start a bucket under it.
 *
 * NO MIGRATIONS (Brad, 2026-10-30: "data is not important ... once everything starts working again, like i intended, is
 * when i start caring about keeping history"): the one-blob seal, the X-Wing form, the bucket kept under the Edge
 * identity id, the v1 seal and the old plain records are no longer read - a bucket kept in one of them is filled again
 * by a sync.
 *
 * THE APP'S STORES SIT ON IT (plan S2): bucketStorage(store) is the feature's storage while the bucket is open.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as bucketLib from 'node-onlykey-lib/bucket';
import {RULES, storeItems} from './bucketRules';
import {storage, type Bucket, type Opened} from './bucket/storage';
import {challengeOpts} from './hostChallenge';
import {getOnlyKey, onKeyForgotten} from './onlykey';
import {activeBackend} from './hooks/KeyContext';
import {noteOwnSecret} from './ownAsks';

type Okcrypto = {
  deriveSecret(label: string, opts?: {touch?: boolean; confirm?: (a: {digits?: number[] | null}) => void; timeoutMs?: number; rpId?: string}): Promise<Uint8Array>;
};

/*
 * THE SEAL'S KEY: derived under the site the key names (ctap_bridge), on every host - no other site derives it, and a
 * key that names none has no bucket here (no fallback: the lib's NO_KEY_SITE, as for the bucket key). One label per
 * identity, so two identities on one key never share a key.
 */
const bucketKeyLabel = (identity: string): string => `okedge/bucket/v2/${identity.toLowerCase()}`;
/* the login plan's derives to open this bucket (IdentityCheckScreen) - each a derive its budget pays; none where it is kept opened */
export async function bucketLabelsOf(identity: string): Promise<string[]> {
  return storage.needsKey ? [bucketKeyLabel(identity)] : [];
}

/*
 * THE BUCKET'S KEY, from the OnlyKey: the touchless derived secret for this identity. The key's derive setting decides
 * whether it asks first (the 3-button code by default): the code is shown by this host (hostChallenge.ts), and onPress
 * says the key is waiting - the soft key's press is the app's to give.
 */
async function bucketKey(identity: string, okcrypto: Okcrypto, onPress?: () => void): Promise<Uint8Array> {
  /* the key's own site, read by the identity plugin and held (no extra request once read) */
  const site = (await (await getOnlyKey(activeBackend())).identity.load()).site;
  if (typeof site !== 'string' || !site) throw Object.assign(new Error("this key names no site (ctap_bridge) - its bucket is sealed under that site, and there is no other"), {code: 'NO_KEY_SITE'});
  const ask = challengeOpts("Opening this identity's bucket");
  /* the soft key's sheet names this derive (its record carries only the label's hash) */
  noteOwnSecret(bucketKeyLabel(identity), false, "Opening this identity's bucket");
  try {
    return await okcrypto.deriveSecret(bucketKeyLabel(identity), {
      confirm: (a) => { onPress?.(); ask.opts.confirm({digits: a.digits ?? undefined}); },
      timeoutMs: 40000,
      rpId: site,
    });
  } finally {
    ask.done();
  }
}

/*
 * What is open.
 *   open      this identity's bucket in memory, kept by this platform's storage; key: the secret that opened it (sealed
 *             rows only - null where the bucket is kept opened)
 *   legacy    the key has no identity (stock v3.0.4 firmware: nothing to tie a bucket to), so the stores keep plain
 *             storage, as before buckets
 *   neither   closed: nothing is read, and a write is refused
 */
/* savedClock: the bucket's clock at its last save - the same clock now means nothing changed since (closeBucket) */
let open: {identity: string; opened: Opened; key: Uint8Array | null; savedClock: string | null} | null = null;
let legacy = false;

const bucket = (): Bucket | null => open?.opened.bucket ?? null;
/* the bucket's clock (lib bucket.js): moves on every write here and on every newer record a merge takes in */
const clockOf = (b: Bucket): string | null => (b as {clock?: string | null}).clock ?? null;
const persist = (): Promise<void> => {
  if (!open) return Promise.resolve();
  const o = open;
  const at = clockOf(o.opened.bucket);
  return o.opened.write().then(() => { o.savedClock = at; });
};
/* taken in from where it is kept (the desktop's shared file, the CLI's writes): saved already - a bucket that had
   nothing unsaved before has nothing unsaved after */
const refresh = async (): Promise<void> => {
  if (!open) return;
  const o = open;
  const clean = clockOf(o.opened.bucket) === o.savedClock;
  await o.opened.refresh();
  if (clean) o.savedClock = clockOf(o.opened.bucket);
};

/** THE BUCKET A TRADE WORKS ON (src/bucketTrade.ts, src/serverRoom.ts): the open one, on every platform - null when closed. */
export function tradeBucket(): {identity: string; bucket: Bucket} | null {
  return open ? {identity: open.identity, bucket: open.opened.bucket} : null;
}

/**
 * Whose bucket is open now, and how (the Sync tab's Identity panel shows it beside the key's own identity - the two must
 * be one): sealed (kept as sealed rows), kept (kept opened - the desktop's shared file), or null (closed, or no identity).
 */
export function openBucketIdentity(): {identity: string; kind: 'sealed' | 'kept'} | null {
  return open ? {identity: open.identity, kind: storage.needsKey ? 'sealed' : 'kept'} : null;
}

/*
 * EACH FEATURE AS THIS DEVICE HOLDS IT (Brad, 2026-10-25: the Sync tab's Features list was empty until a first sync -
 * "it should show the status of itself"): per store, its items, by the lib's store rules.
 */
export async function bucketSummary(): Promise<Record<string, number> | null> {
  if (!open) return null;
  await refresh();
  return storeItems(open.opened.bucket);
}

/** A trade changed the open bucket: kept again. */
export function saveTradedBucket(): Promise<void> {
  return persist();
}

/**
 * Closed (a lock, another key, the key unplugged): the bucket in memory goes with it, its key is wiped, and who the key
 * was is forgotten.
 *
 * SEALED AND SAVED BEFORE IT GOES (Brad, 2026-10-31: "decrypted stuff should be encrypted and saved before being
 * cleared") - ONLY IF IT NEEDS IT ("check state to even see if it needs this, because it could be NOT stale and
 * already saved and sync'd"): the bucket's clock still the one its last save had means nothing changed since, and
 * nothing is written. Changed: one last write, queued behind any write still sealing (each storage writes one at a
 * time); it needs nothing of the key, which may be gone (the sealing keys are derived at open, lib sealedcopy
 * keysOf). No new write starts on it - the bucket is closed at once.
 */
export function closeBucket(): Promise<void> {
  const was = open;
  open = null;
  legacy = false;
  if (!was) return Promise.resolve();
  if (clockOf(was.opened.bucket) === was.savedClock) {
    was.key?.fill(0);
    return Promise.resolve();
  }
  console.log(`[bucket] ${was.identity.slice(0, 12)}: changed since its last save - sealed and saved before closing`);
  return was.opened
    .write()
    .catch((e: unknown) => console.log(`[bucket] ${was.identity.slice(0, 12)}: the last save before closing failed - ${String((e as Error)?.message ?? e)}`))
    .finally(() => was.key?.fill(0));
}

/** The key has no identity to tie a bucket to: its stores keep plain storage. */
export function openLegacyStorage(): void {
  legacy = true;
}

/*
 * A WHOLE STORE, AND MANY KEYS IN ONE WRITE (Phase 5: the Edge log's blocks). null with no bucket open (nothing
 * written). On the desktop the CLI writes the same file, so a read takes in what it wrote first.
 */
export async function storeEntries(store: string): Promise<Record<string, string> | null> {
  if (!open) return null;
  await refresh();
  const out: Record<string, string> = {};
  for (const [k, r] of Object.entries((open.opened.bucket.stores[store] ?? {}) as Record<string, {v: string | null; archived?: boolean}>)) if (r && !r.archived && r.v !== null) out[k] = r.v;
  return out;
}
export async function writeEntries(store: string, entries: Record<string, string>): Promise<boolean> {
  const b = bucket();
  if (!b) return false;
  if (!Object.keys(entries).length) return true;
  const kv = bucketLib.kv(b, store);
  for (const [k, v] of Object.entries(entries)) kv.setItem(k, v);
  await persist();
  return true;
}

/** A feature's storage: its store in the open bucket, or plain storage for a key with no identity. */
export type BucketKv = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  /* old plain records are no longer moved in (no migrations): kept so a feature's call stays valid */
  moveInPrefix(prefix: string): Promise<void>;
};

/**
 * One store of the open bucket. store: the store's name in the bucket; legacy: the plain record a key with no identity
 * keeps each key under. (moves: no longer used - no migrations.)
 */
export function bucketStorage(store: () => string, legacyKey: (key: string) => string, _moves: string[] = []): BucketKv {
  const refused = (): Error =>
    Object.assign(new Error('no bucket is open: unlock the key and continue past the identity check'), {code: 'EBUCKET_CLOSED'});
  return {
    async getItem(key) {
      if (legacy) return AsyncStorage.getItem(legacyKey(key));
      const b = bucket();
      return b ? bucketLib.kv(b, store()).getItem(key) : null;
    },
    async setItem(key, value) {
      if (legacy) return AsyncStorage.setItem(legacyKey(key), value);
      const b = bucket();
      if (!b) throw refused();
      bucketLib.kv(b, store()).setItem(key, value);
      await persist();
    },
    async removeItem(key) {
      if (legacy) return AsyncStorage.removeItem(legacyKey(key));
      const b = bucket();
      if (!b) throw refused();
      bucketLib.kv(b, store()).removeItem(key);
      await persist();
    },
    moveInPrefix: async () => {},
  };
}

/**
 * A FLOW THAT STARTS WITHOUT THE IDENTITY CHECK (the autofill sheet: Android opens it over another app, the identity
 * check may never have run in this process): open the bucket of the key it talks to, as the identity check does - the
 * key's press included. A bucket already open is used as it is.
 */
export async function ensureBucketOpen(app: {okcrypto: unknown; identity: {load(): Promise<{id: string}>}}, onPress?: () => void): Promise<void> {
  if (open || legacy) return;
  /* who the key is: the identity plugin's read, held (lib plugins/identity) - not the key asked again */
  const {id} = await app.identity.load();
  await openIdentityBucket(id, app.okcrypto as Okcrypto, onPress);
}

/**
 * What opening this identity's bucket will take, asked before it is opened (the identity check's button):
 * kept - kept opened here (the desktop): no key, no press; sealed - kept as sealed rows: the key's derive opens them;
 * none - not made yet: the key proves the identity (a signature), and a new one is made.
 */
export function bucketState(identity: string): Promise<'kept' | 'sealed' | 'none'> {
  return storage.state(identity.toLowerCase());
}

/**
 * Open this identity's bucket: the identity check's Continue.
 * identity: the BUCKET IDENTITY id (lib bucket-identity: the key's "" agent key); onPress: the key is waiting for the
 * press (the soft key's is the app's to give).
 * -> created: a new, empty bucket was made; pressed: the key was asked (a derive or a signature).
 */
export async function openIdentityBucket(identity: string, okcrypto: Okcrypto, onPress?: () => void): Promise<{created: boolean; pressed: boolean}> {
  const id = identity.toLowerCase();
  const identityService = (await getOnlyKey(activeBackend())).identity;
  const state = await storage.state(id);
  /*
   * THE KEY PROVES ITSELF TO THE USER'S SERVER FIRST (serverRoom logIn; Brad, 2026-11-01: "authenticating with mcp
   * instead of itself"; "if remote mcp server is alive, auth with that, not with local"): proven there, nothing below
   * asks for another proof. The server not reachable (a phone or a desktop off line): the key signs a challenge this app
   * makes. The web app has no such fallback: logIn throws.
   */
  const proven = await require('./serverRoom').logIn(id, onPress);
  const proveHere = async () => {
    if (proven) return;
    const prove = challengeOpts('Proving this key holds the identity');
    try { await identityService.verify(prove.opts); } finally { prove.done(); }
  };
  if (state === 'kept') {
    /* kept opened here (the desktop's file, shared with the CLI): it opens with no key once the key is proven */
    await proveHere();
    const opened = await storage.open(id, null, () => { throw new Error('kept opened: no rows to prove'); });
    if (opened) {
      console.log(`[bucket] ${id.slice(0, 12)}: proven; kept opened on this computer (shared with the CLI)`);
      open = {identity: id, opened, key: null, savedClock: clockOf(opened.bucket)};
      return {created: false, pressed: true};
    }
  }
  if (state === 'sealed') {
    const key = await bucketKey(id, okcrypto, onPress);
    const opened = await storage.open(id, key, rows => identityService.proveByRows({rows, key, rules: RULES}).bucket as Bucket);
    if (opened) {
      console.log(`[identity] ${id.slice(0, 12)}: proven - the key opened the rows this device kept for it`);
      open = {identity: id, opened, key, savedClock: clockOf(opened.bucket)};
      return {created: false, pressed: true};
    }
  }
  /* nothing kept: proven (to a server, or a fresh challenge here), then a new bucket - the server's copy fills it */
  await proveHere();
  console.log(`[identity] ${id.slice(0, 12)}: proven ${proven ? 'to the server' : '- the key signed a fresh challenge with the identity key'}; a new bucket`);
  const key = storage.needsKey ? await bucketKey(id, okcrypto, onPress) : null;
  const created = await storage.create(id, key);
  open = {identity: id, opened: created, key, savedClock: clockOf(created.bucket)};
  return {created: true, pressed: true};
}

/*
 * A KEPT LOGIN, ON A RELOAD (webSession.ts; Brad, 2026-10-29: stay logged in, asked at login): this identity's rows
 * opened with the secret this tab kept from its login - no derive, no press. The key was read just now (the identity
 * check: present, unlocked, this identity), and the rows opening with that secret and naming this identity is the
 * proof. Kept opened (nothing sealed), none kept, or they do not open: false, and the login asks as always.
 */
export async function openIdentityBucketWithSecret(identity: string, secret: Uint8Array): Promise<boolean> {
  if (!storage.needsKey) return false;
  const id = identity.toLowerCase();
  const identityService = (await getOnlyKey(activeBackend())).identity;
  const key = Uint8Array.from(secret);
  try {
    const opened = await storage.open(id, key, rows => identityService.proveByRows({rows, key, rules: RULES}).bucket as Bucket);
    if (!opened) return false;
    open = {identity: id, opened, key, savedClock: clockOf(opened.bucket)};
  } catch (e) {
    console.log(`[bucket] ${id.slice(0, 12)}: the kept login did not open the rows - ${String((e as Error)?.message ?? e)}`);
    return false;
  }
  console.log(`[bucket] ${id.slice(0, 12)}: opened with this tab's kept login - no press`);
  return true;
}

/** The open bucket's secret (a copy), for a login the person chose to keep (webSession.ts) - null unless sealed and open. */
export function doorSecret(): Uint8Array | null {
  return open?.key ? Uint8Array.from(open.key) : null;
}

/*
 * THE KEY FORGOTTEN, THE BUCKET CLOSES (Brad, 2026-11-03: "if things stay loaded, they get a forget event"): the forget is
 * the cause (an unplug, a lock, the Log in page, another key) and this its consequence - not the other way round, which
 * forgot the key whenever a bucket closed (config mode closes one, and keeps its key: "unless config mode").
 */
onKeyForgotten(() => { void closeBucket(); });

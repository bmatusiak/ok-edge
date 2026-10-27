/*
 * THIS IDENTITY'S BUCKET, opened by the key (Brad, 2026-10-24: after the identity check's Continue, "a button
 * press here is needed to decrypt the container").
 *
 * One bucket per identity per net. It is stored SEALED UNDER A KEY THE ONLYKEY DERIVES (PROPOSAL-derived-keys.md,
 * Brad 2026-10-27; firmware plugin derive_secret): okcrypto.deriveSecret("okedge/bucket/v1/<identity>"), the touchless
 * key - 32 bytes in one request, protected by the key's derive setting (field 30: the code by default) until the
 * person unprotects it - and the app seals with it itself (lib bucket.seal, AES-256-GCM). It replaced the age file to
 * the key's X-Wing recipient, which the key had to decapsulate: a 1,289-byte answer in chunks, two WebAuthn round
 * trips each on Windows. No migration (pre-v1): a bucket still stored in the X-Wing form is dropped and filled again
 * by a sync. Where the
 * OPENED bucket lives is the shell's (Brad, 2026-10-24: "the webapp has no way to save decrypted stuff, the desktop
 * cli share the same file system, identity check switch to the decrypted bucket on desktop, while webapp always has
 * an encrypted bucket"):
 *   - the phone keeps it sealed in its storage and opens it in memory, at every identity check;
 *   - the desktop opens it ONCE and keeps it opened in the CLI's folder (~/.onlykey-js/buckets/<net>/<id>.json,
 *     lib bucket/cli/home.js), so the desktop and the CLI share one bucket; its identity check after that switches
 *     to that file with no press;
 *   - the web app (plan S5) only ever holds it sealed, and keeps nothing opened.
 * The first time an identity is seen, an empty bucket is made for it: no key, no press.
 *
 * THE APP'S STORES SIT ON IT (plan S2): bucketStorage(store) is the feature's storage while the door is open.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as bucketLib from 'node-onlykey-lib/bucket';
import {currentNet} from './net';
import {desktop} from './platform';
import {storeItems} from './bucketRules';
import {challengeOpts} from './hostChallenge';

type Bucket = ReturnType<typeof bucketLib.create>;
type Okcrypto = {
  deriveSecret(label: string, opts?: {touch?: boolean; confirm?: (a: {digits?: number[] | null}) => void; timeoutMs?: number}): Promise<Uint8Array>;
};

/* the label of this identity's bucket key: one per identity, so two identities on one key never share it */
const bucketKeyLabel = (identity: string): string => `okedge/bucket/v1/${identity.toLowerCase()}`;
const randomBytes = (n: number): Uint8Array => crypto.getRandomValues(new Uint8Array(n));

/*
 * THE BUCKET'S KEY, from the OnlyKey: the touchless derived secret for this identity. The key's derive setting decides
 * whether it asks first (the 3-button code by default): the code is shown by this host (hostChallenge.ts, the same
 * sheet as the bucket key's), and onPress says the key is waiting - the soft key's press is the app's to give.
 */
async function bucketKey(identity: string, okcrypto: Okcrypto, onPress?: () => void): Promise<Uint8Array> {
  const ask = challengeOpts("Opening this identity's bucket");
  try {
    return await okcrypto.deriveSecret(bucketKeyLabel(identity), {
      confirm: (a) => { onPress?.(); ask.opts.confirm({digits: a.digits ?? undefined}); },
      timeoutMs: 40000,
    });
  } finally {
    ask.done();
  }
}

/*
 * THE PHONE'S SEALED BUCKET, one per identity per net: the testnet's records stay apart from the live ones, as
 * every other record does - and okrn.bucket.test.<identity> is a feature's test record by its name (testnet.ts
 * TEST_KEYS), so Clear testnet removes the testnet's bucket with the rest, without having to open it.
 * (The desktop kept its sealed bucket here too before the shared file; the identity check moves it.)
 */
const KEY = (identity: string): string => `okrn.bucket.${currentNet() === 'test' ? 'test.' : ''}${identity.toLowerCase()}`;

/*
 * The door's state.
 *   'sealed': the phone and the web app - this identity's bucket opened in memory; every write stores it sealed
 *             again under the bucket key derived when it opened, so a write needs no key and no press.
 *   'kept':   the desktop - the bucket is the shared file; every read and write goes to it (a locked
 *             read-modify-write in the main process, as the CLI's).
 *   'legacy': the key has no Edge identity (stock v3.0.4 firmware: nothing to seal a bucket to), so the stores
 *             keep today's plain storage.
 *   'closed': no door is open - nothing is read, and a write is refused.
 */
type Door =
  | {kind: 'closed'}
  | {kind: 'legacy'}
  | {kind: 'sealed'; identity: string; bucket: Bucket; key: Uint8Array; movedPrefixes: Set<string>}
  | {kind: 'kept'; identity: string; net: string; movedPrefixes: Set<string>};
let door: Door = {kind: 'closed'};

/* one sealed write at a time, so the last stored is the newest bucket (writes arrive back to back) */
let writes: Promise<unknown> = Promise.resolve();

/**
 * THE BUCKET A TRADE WORKS ON (src/bucketTrade.ts): the phone's, opened in memory - null with the door shut, or on a
 * computer, where the CLI trades the kept file itself (lib bucket/cli/trade.js).
 */
export function tradeBucket(): {identity: string; bucket: Bucket} | null {
  return door.kind === 'sealed' ? {identity: door.identity, bucket: door.bucket} : null;
}

/**
 * Whose bucket is open now, and how (the Sync tab's Identity panel shows it beside the key's own identity - the two must
 * be one): sealed (the phone, opened in memory), kept (the desktop, the opened file), or null (closed, or no identity).
 */
export function openBucketIdentity(): {identity: string; kind: 'sealed' | 'kept'} | null {
  return door.kind === 'sealed' || door.kind === 'kept' ? {identity: door.identity, kind: door.kind} : null;
}

/*
 * EACH FEATURE AS THIS DEVICE HOLDS IT (Brad, 2026-10-25: the Sync tab's Features list was empty until a first sync -
 * "it should show the status of itself"): per store, its items, from the bucket open here - the phone's in memory, the
 * desktop's kept file (asked of the main process, which reads it with the same lib rules).
 */
export async function bucketSummary(): Promise<Record<string, number> | null> {
  if (door.kind === 'sealed') return storeItems(door.bucket);
  if (door.kind === 'kept') return (await desktop!.invoke('okedge:bucketSummary', door.identity, door.net)) as Record<string, number>;
  return null;
}

/** A trade changed the opened bucket: stored sealed again. */
export function saveTradedBucket(): Promise<void> {
  return persist();
}

/** The door closed (a lock, another key): an opened bucket in memory goes with it, and its key is wiped. */
export function closeBucket(): void {
  if (door.kind === 'sealed') door.key.fill(0);
  door = {kind: 'closed'};
}

/** The key has no identity to seal a bucket to: its stores keep today's plain storage. */
export function openLegacyStorage(): void {
  door = {kind: 'legacy'};
}

/* the phone: store the opened bucket sealed again; the in-memory bucket is already changed */
function persist(): Promise<void> {
  const d = door;
  if (d.kind !== 'sealed') return Promise.resolve();
  const text = bucketLib.seal(d.bucket, d.key, randomBytes);
  const run = writes.then(() => AsyncStorage.setItem(KEY(d.identity), text));
  writes = run.catch(() => {});
  return run;
}

/* one store's key in the open bucket, wherever the door keeps it (null value = removed) */
async function getIn(store: string, key: string): Promise<string | null> {
  if (door.kind === 'sealed') return bucketLib.kv(door.bucket, store).getItem(key);
  if (door.kind === 'kept') return (await desktop!.invoke('okedge:bucketGet', door.identity, door.net, store, key)) as string | null;
  return null;
}
async function setIn(store: string, key: string, value: string | null): Promise<void> {
  if (door.kind === 'kept') {
    await desktop!.invoke('okedge:bucketSet', door.identity, door.net, store, key, value);
    return;
  }
  if (door.kind !== 'sealed') return;
  const kv = bucketLib.kv(door.bucket, store);
  if (value === null) kv.removeItem(key);
  else kv.setItem(key, value);
  await persist();
}

/*
 * WHAT MOVES IN (copy first, as B3.0 did): a feature's old plain record, on the current net, into its store in
 * the bucket. Stored in the bucket first, then the plain one removed - a stop between the two leaves both, never
 * neither. A key the bucket already has is not overwritten: the old record is left for the next look.
 * The old records were the phone's, not an identity's: the first identity opened on this net takes them.
 * Each feature names its own (bucketStorage's moves), so core never names a plugin's records.
 */
type Move = {legacy: () => string; store: () => string; key: string};
const MOVES: Move[] = [];

async function moveIn(store: string, pairs: {legacy: string; key: string}[]): Promise<void> {
  if (door.kind !== 'sealed' && door.kind !== 'kept') return;
  const moved: string[] = [];
  for (const {legacy, key} of pairs) {
    const old = await AsyncStorage.getItem(legacy);
    if (old === null || (await getIn(store, key)) !== null) continue;
    if (door.kind === 'sealed') bucketLib.kv(door.bucket, store).setItem(key, old);
    else await setIn(store, key, old);
    moved.push(legacy);
  }
  if (!moved.length) return;
  await persist();
  for (const k of moved) await AsyncStorage.removeItem(k);
  console.log(`[bucket] moved into this identity's bucket (${store}): ${moved.length > 3 ? `${moved.length} records` : moved.join(', ')}`);
}

async function moveOldRecords(): Promise<void> {
  for (const m of MOVES) await moveIn(m.store(), [{legacy: m.legacy(), key: m.key}]);
}

/** A feature's storage: its store in the opened bucket, or today's plain storage for a key with no identity. */
export type BucketKv = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  /**
   * Move in every old plain record under one prefix of this store's keys, once per open bucket - for records
   * that belong to one key, not to the phone (Passwords' stores, each named by its key's id): the feature
   * calls it when that key's store is first read, so another key's records are never taken.
   */
  moveInPrefix(prefix: string): Promise<void>;
};

/**
 * One store of the open door. store: the store's name in the bucket; legacy: the plain record each key was
 * kept under before (only a key with no identity still uses it); moves: the keys whose old plain record moves
 * into the bucket the first time it opens.
 */
export function bucketStorage(store: () => string, legacy: (key: string) => string, moves: string[] = []): BucketKv {
  for (const key of moves) MOVES.push({legacy: () => legacy(key), store, key});
  const refused = (): Error =>
    Object.assign(new Error('no bucket is open: unlock the key and continue past the identity check'), {code: 'EBUCKET_CLOSED'});
  return {
    async getItem(key) {
      if (door.kind === 'legacy') return AsyncStorage.getItem(legacy(key));
      return getIn(store(), key);
    },
    async setItem(key, value) {
      if (door.kind === 'legacy') return AsyncStorage.setItem(legacy(key), value);
      if (door.kind === 'closed') throw refused();
      await setIn(store(), key, value);
    },
    async removeItem(key) {
      if (door.kind === 'legacy') return AsyncStorage.removeItem(legacy(key));
      if (door.kind === 'closed') throw refused();
      await setIn(store(), key, null);
    },
    async moveInPrefix(prefix) {
      if (door.kind !== 'sealed' && door.kind !== 'kept') return;
      const name = store();
      const done = `${name} ${prefix}`;
      if (door.movedPrefixes.has(done)) return;
      door.movedPrefixes.add(done);
      const from = legacy(prefix);
      const old = (await AsyncStorage.getAllKeys()).filter(k => k.startsWith(from));
      await moveIn(name, old.map(k => ({legacy: k, key: prefix + k.slice(from.length)})));
    },
  };
}

/**
 * A FLOW THAT STARTS WITHOUT THE DOOR (the autofill sheet: Android opens it over another app, the identity check
 * may never have run in this process): open the bucket of the key it talks to, as the identity check does - the
 * key's press included. A door already open is used as it is.
 */
export async function ensureBucketOpen(
  app: {edge?: {probe(o?: {timeoutMs?: number}): Promise<string>; identityId(): Promise<string>}; okcrypto: unknown},
  onPress?: () => void,
): Promise<void> {
  if (door.kind !== 'closed') return;
  const okcrypto = app.okcrypto as Okcrypto & {agent: {publicKey: Function}};
  const {id} = await bucketLib.bucketIdentity.readIdentity(okcrypto);
  await openIdentityBucket(id, okcrypto, onPress, await edgeIdentityOf(app));
}

/** The key's Edge identity id when it has Edge - only to move a bucket kept under it before (null otherwise). */
export async function edgeIdentityOf(app: {edge?: {probe(o?: {timeoutMs?: number}): Promise<string>; identityId(): Promise<string>}}): Promise<string | null> {
  try {
    if (!app.edge || (await app.edge.probe({timeoutMs: 4000})) !== 'edge') return null;
    return (await app.edge.identityId()).toLowerCase();
  } catch {
    return null;
  }
}

/*
 * THE OWNER MOVED ONCE (Brad, 2026-10-25: the bucket identity - the key's "" agent key - owns the bucket, "nothing to
 * do with edge"). A bucket stored before under the key's Edge identity id (`previous`) is this identity's: on the
 * phone it is opened with the key under its old owner and stored again under the new one; on the desktop the kept
 * file is renamed by the main process (lib home.moveIdentityBucket). Only when nothing is stored under the new id.
 */
const sealedUnder = async (id: string, previous?: string | null): Promise<{text: string; owner: string} | null> => {
  const now = await AsyncStorage.getItem(KEY(id));
  if (now !== null) return {text: now, owner: id};
  if (!previous || previous === id) return null;
  const before = await AsyncStorage.getItem(KEY(previous));
  return before === null ? null : {text: before, owner: previous};
};

/**
 * What opening this identity's bucket will take, asked before it is opened (the identity check's button):
 * 'kept' - this computer already keeps it opened (the desktop, after its first open): no key, no press;
 * 'sealed' - stored sealed: the key decrypts it, with a press; 'none' - not made yet: a new one, no press.
 * previous: the key's Edge identity id, under which a bucket may still be stored from before the move.
 */
export async function bucketState(identity: string, previous?: string | null): Promise<'kept' | 'sealed' | 'none'> {
  const id = identity.toLowerCase();
  if (desktop) {
    if (await desktop.invoke('okedge:bucketHas', id, currentNet())) return 'kept';
    if (previous && previous !== id && (await desktop.invoke('okedge:bucketHas', previous, currentNet()))) return 'kept';
  }
  return (await sealedUnder(id, previous)) !== null ? 'sealed' : 'none';
}

/*
 * A stored bucket opened with the bucket key; null when it is still in the X-Wing form (sealed to the key, before
 * derive_secret) - no migration, pre-v1: it is dropped and the bucket filled again by a sync.
 */
function openSealed(text: string, key: Uint8Array): Bucket | null {
  try {
    if (JSON.parse(text)?.format !== 'onlykey-bucket-sealed') return null;
  } catch {
    return null;
  }
  return bucketLib.open(text, {key}).bucket;
}

/**
 * Open this identity's bucket: the identity check's Continue.
 * identity: the BUCKET IDENTITY id (lib bucket-identity: the key's "" agent key);
 * onPress: the key is waiting for the press (the soft key's is the app's to give);
 * previous: the key's Edge identity id, for the one-time move of a bucket stored under it.
 * -> created: a new, empty bucket was made; pressed: the key opened a sealed one.
 */
export async function openIdentityBucket(identity: string, okcrypto: Okcrypto, onPress?: () => void, previous?: string | null): Promise<{created: boolean; pressed: boolean}> {
  const id = identity.toLowerCase();
  const prev = previous ? previous.toLowerCase() : null;
  if (desktop) return openKept(id, okcrypto, onPress, prev);
  const stored = await sealedUnder(id, prev);
  console.log(`[bucket] ${id.slice(0, 12)}: ${stored ? `a sealed bucket is stored${stored.owner !== id ? ' (under the Edge identity - moved now)' : ''} - opened with the key's bucket key` : 'none stored - sealing a new one'}`);
  /* the bucket key: derived once here; every later write seals with it, no key and no press */
  const key = await bucketKey(id, okcrypto, onPress);
  const opened = stored ? openSealed(stored.text, key) : null;
  if (stored && !opened) console.log(`[bucket] ${id.slice(0, 12)}: the stored bucket is in the X-Wing form - dropped (no migration); a sync fills it again`);
  const bucket = opened ?? bucketLib.create({owner: id});
  bucket.owner = id;
  door = {kind: 'sealed', identity: id, bucket, key, movedPrefixes: new Set()};
  if (!opened || stored!.owner !== id) await persist();
  if (stored && stored.owner !== id) await AsyncStorage.removeItem(KEY(stored.owner));
  await moveOldRecords();
  return {created: !opened, pressed: true};
}

/*
 * THE DESKTOP: switch to the bucket this computer already keeps opened (no press) - moved first from the Edge identity
 * id it was kept under before, if so; else open the sealed one it kept in the page before (the key's press) or make a
 * new one, and keep it in the shared file from now on.
 */
async function openKept(id: string, okcrypto: Okcrypto, onPress?: () => void, previous?: string | null): Promise<{created: boolean; pressed: boolean}> {
  const net = currentNet();
  const kept = {kind: 'kept' as const, identity: id, net, movedPrefixes: new Set<string>()};
  if (previous && previous !== id && (await desktop!.invoke('okedge:bucketMove', previous, id, net))) {
    console.log(`[bucket] ${id.slice(0, 12)}: the bucket kept under the Edge identity ${previous.slice(0, 12)} moved to the bucket identity`);
  }
  if (await desktop!.invoke('okedge:bucketHas', id, net)) {
    console.log(`[bucket] ${id.slice(0, 12)}: kept opened on this computer (shared with the CLI) - no press`);
    door = kept;
    await moveOldRecords();
    return {created: false, pressed: false};
  }
  const stored = await sealedUnder(id, previous);
  console.log(`[bucket] ${id.slice(0, 12)}: ${stored ? 'a sealed bucket from the page - opened once with the key\'s bucket key' : 'none kept - a new one'}`);
  const opened = stored ? openSealed(stored.text, await bucketKey(id, okcrypto, onPress)) : null;
  const bucket = opened ?? bucketLib.create({owner: id});
  bucket.owner = id;
  await desktop!.invoke('okedge:bucketKeep', id, net, bucketLib.serialize(bucket));
  if (stored) await AsyncStorage.removeItem(KEY(stored.owner));
  door = kept;
  await moveOldRecords();
  return {created: !opened, pressed: !!stored};
}

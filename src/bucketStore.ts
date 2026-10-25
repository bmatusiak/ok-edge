/*
 * THIS IDENTITY'S BUCKET, opened by the key (Brad, 2026-10-24: after the identity check's Continue, "a button
 * press here is needed to decrypt the container").
 *
 * One bucket per identity per net. It travels sealed: an age file to the key's own X-Wing recipient
 * (node-onlykey-lib bucket sealToKey), which only the key opens - the key's X-Wing step, with a press. Where the
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

type Bucket = ReturnType<typeof bucketLib.create>;
type Okcrypto = {
  deviceAge: {
    identity(label: string): Promise<{recipient: Uint8Array}>;
    encrypt(plaintext: Uint8Array, recipient: Uint8Array | string): Uint8Array;
    decrypt(age: Uint8Array, label: string, opts?: {confirm?: () => void; onKeepAlive?: () => void; requirePress?: boolean}): Promise<Uint8Array>;
  };
};

/*
 * THE PHONE'S SEALED BUCKET, one per identity per net: the testnet's records stay apart from the live ones, as
 * every other record does - and okrn.bucket.test.<identity> is a feature's test record by its name (testnet.ts
 * TEST_KEYS), so Clear testnet removes the testnet's bucket with the rest, without having to open it.
 * (The desktop kept its sealed bucket here too before the shared file; the identity check moves it.)
 */
const KEY = (identity: string): string => `okrn.bucket.${currentNet() === 'test' ? 'test.' : ''}${identity.toLowerCase()}`;

/*
 * The door's state.
 *   'sealed': the phone - this identity's bucket opened in memory; every write stores it sealed again, to the
 *             recipient read when it opened, so a write needs no key and no press.
 *   'kept':   the desktop - the bucket is the shared file; every read and write goes to it (a locked
 *             read-modify-write in the main process, as the CLI's).
 *   'legacy': the key has no Edge identity (stock v3.0.4 firmware: nothing to seal a bucket to), so the stores
 *             keep today's plain storage.
 *   'closed': no door is open - nothing is read, and a write is refused.
 */
type Door =
  | {kind: 'closed'}
  | {kind: 'legacy'}
  | {kind: 'sealed'; identity: string; bucket: Bucket; recipient: Uint8Array; encrypt: (p: Uint8Array, r: Uint8Array | string) => Uint8Array; movedPrefixes: Set<string>}
  | {kind: 'kept'; identity: string; net: string; movedPrefixes: Set<string>};
let door: Door = {kind: 'closed'};

/* one sealed write at a time, so the last stored is the newest bucket (writes arrive back to back) */
let writes: Promise<unknown> = Promise.resolve();

/** The door closed (a lock, another key): an opened bucket in memory goes with it. */
export function closeBucket(): void {
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
  const text = bucketLib.sealToKey(d.bucket, d.recipient, d.encrypt);
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

/* the key opens a sealed bucket - always with its press */
async function openSealed(text: string, owner: string, okcrypto: Okcrypto, onPress?: () => void): Promise<Bucket> {
  /* the press sheet names this ask as the app's own, not "an identity nobody listed" (required here, not imported:
     pressAsk reads the Key Chain, which sits on this store) */
  require('./pressAsk').noteOwnAsk(bucketLib.AGE_LABEL, "this identity's bucket");
  const {bucket} = await bucketLib.openWithKey(text, {
    owner,
    /*
     * ALWAYS A PRESS (Brad: "a button press here is needed"): 3.1.0's device-custody decrypt asks for one by
     * itself (confirm); the older X-Wing path is a shared-secret derive, asked here in its press-first form
     * (requirePress) - the box key opened the bucket without one before. Either wait says "press".
     */
    decrypt: (age: Uint8Array, label: string) => okcrypto.deviceAge.decrypt(age, label, {requirePress: true, confirm: () => onPress?.(), onKeepAlive: () => onPress?.()}),
  });
  return bucket;
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
  console.log(`[bucket] ${id.slice(0, 12)}: ${stored ? `a sealed bucket is stored${stored.owner !== id ? ' (under the Edge identity - moved now)' : ''} - the key opens it` : 'none stored - sealing a new one'}`);
  /* the recipient is public: read once here, every later write seals to it with no key and no press */
  const {recipient} = await okcrypto.deviceAge.identity(bucketLib.AGE_LABEL);
  const encrypt = (p: Uint8Array, r: Uint8Array | string) => okcrypto.deviceAge.encrypt(p, r);
  const bucket = stored ? await openSealed(stored.text, stored.owner, okcrypto, onPress) : bucketLib.create({owner: id});
  bucket.owner = id;
  door = {kind: 'sealed', identity: id, bucket, recipient, encrypt, movedPrefixes: new Set()};
  if (!stored || stored.owner !== id) await persist();
  if (stored && stored.owner !== id) await AsyncStorage.removeItem(KEY(stored.owner));
  await moveOldRecords();
  return {created: !stored, pressed: !!stored};
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
  console.log(`[bucket] ${id.slice(0, 12)}: ${stored ? 'a sealed bucket from the page - the key opens it once' : 'none kept - a new one'}`);
  const bucket = stored ? await openSealed(stored.text, stored.owner, okcrypto, onPress) : bucketLib.create({owner: id});
  bucket.owner = id;
  await desktop!.invoke('okedge:bucketKeep', id, net, bucketLib.serialize(bucket));
  if (stored) await AsyncStorage.removeItem(KEY(stored.owner));
  door = kept;
  await moveOldRecords();
  return {created: !stored, pressed: !!stored};
}

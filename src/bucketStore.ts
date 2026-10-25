/*
 * THIS IDENTITY'S BUCKET, opened by the key (Brad, 2026-10-24: after the identity check's Continue, "a button
 * press here is needed to decrypt the container").
 *
 * One sealed bucket per identity, kept in the app's storage only in its sealed form: an age file to the key's
 * own X-Wing recipient (node-onlykey-lib bucket sealToKey). Opening it is the key's X-Wing step - the key asks
 * for a press - and the opened bucket lives in memory only, until the door closes (a lock, another key).
 * The first time an identity is seen, an empty bucket is sealed for it: sealing needs no key and no press.
 *
 * THE APP'S STORES SIT ON IT (plan S2): bucketStorage(store) is the feature's storage while the door is open.
 * Every write changes the bucket in memory and stores it sealed again - to the recipient read when it opened,
 * so a write needs no key and no press. Nothing a store keeps is written anywhere in the clear.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as bucketLib from 'node-onlykey-lib/bucket';
import {currentNet} from './net';

type Bucket = ReturnType<typeof bucketLib.create>;
type Okcrypto = {
  deviceAge: {
    identity(label: string): Promise<{recipient: Uint8Array}>;
    encrypt(plaintext: Uint8Array, recipient: Uint8Array | string): Uint8Array;
    decrypt(age: Uint8Array, label: string, opts?: {confirm?: () => void; onKeepAlive?: () => void; requirePress?: boolean}): Promise<Uint8Array>;
  };
};

/*
 * ONE BUCKET PER IDENTITY PER NET: the testnet's records stay apart from the live ones, as every other record
 * does - and okrn.bucket.test.<identity> is a feature's test record by its name (testnet.ts TEST_KEYS), so
 * Clear testnet removes the testnet's bucket with the rest, without having to open it.
 */
const KEY = (identity: string): string => `okrn.bucket.${currentNet() === 'test' ? 'test.' : ''}${identity.toLowerCase()}`;

/*
 * The door's state. 'bucket': this identity's bucket is open, the stores read and write it. 'legacy': the key
 * has no Edge identity (stock v3.0.4 firmware: nothing to seal a bucket to), so the stores keep today's plain
 * storage. 'closed': no door is open - nothing is read, and a write is refused rather than put in the clear.
 */
type Door =
  | {kind: 'closed'}
  | {kind: 'legacy'}
  | {kind: 'bucket'; identity: string; bucket: Bucket; recipient: Uint8Array; encrypt: (p: Uint8Array, r: Uint8Array | string) => Uint8Array; movedPrefixes: Set<string>};
let door: Door = {kind: 'closed'};

/* one sealed write at a time, so the last stored is the newest bucket (writes arrive back to back) */
let writes: Promise<unknown> = Promise.resolve();

/** The bucket opened for this session, or null - nothing of it is kept unsealed anywhere else. */
export function openedBucket(): {identity: string; bucket: Bucket} | null {
  return door.kind === 'bucket' ? {identity: door.identity, bucket: door.bucket} : null;
}

/** The door closed (a lock, another key): the opened bucket goes with it. */
export function closeBucket(): void {
  door = {kind: 'closed'};
}

/** The key has no identity to seal a bucket to: its stores keep today's plain storage. */
export function openLegacyStorage(): void {
  door = {kind: 'legacy'};
}

/* store the opened bucket sealed again; the in-memory bucket is already changed */
function persist(): Promise<void> {
  const d = door;
  if (d.kind !== 'bucket') return Promise.resolve();
  const text = bucketLib.sealToKey(d.bucket, d.recipient, d.encrypt);
  const run = writes.then(() => AsyncStorage.setItem(KEY(d.identity), text));
  writes = run.catch(() => {});
  return run;
}

/*
 * WHAT MOVES IN (copy first, as B3.0 did): a feature's old plain record, on the current net, into its store in
 * the bucket. Stored sealed first, then the plain one removed - a stop between the two leaves both, never
 * neither. A store the bucket already has is not overwritten: the old record is left for the next look.
 * The old records were the phone's, not an identity's: the first identity opened on this net takes them.
 * Each feature names its own (bucketStorage's moves), so core never names a plugin's records.
 */
type Move = {legacy: () => string; store: () => string; key: string};
const MOVES: Move[] = [];

/* old plain records -> keys of one store in the open bucket: sealed first, then the plain ones removed */
async function moveIn(store: string, pairs: {legacy: string; key: string}[]): Promise<void> {
  if (door.kind !== 'bucket') return;
  const kv = bucketLib.kv(door.bucket, store);
  const moved: string[] = [];
  for (const {legacy, key} of pairs) {
    const old = await AsyncStorage.getItem(legacy);
    if (old === null || kv.getItem(key) !== null) continue;
    kv.setItem(key, old);
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
      if (door.kind === 'bucket') return bucketLib.kv(door.bucket, store()).getItem(key);
      if (door.kind === 'legacy') return AsyncStorage.getItem(legacy(key));
      return null;
    },
    async setItem(key, value) {
      if (door.kind === 'legacy') return AsyncStorage.setItem(legacy(key), value);
      if (door.kind !== 'bucket') throw refused();
      bucketLib.kv(door.bucket, store()).setItem(key, value);
      await persist();
    },
    async removeItem(key) {
      if (door.kind === 'legacy') return AsyncStorage.removeItem(legacy(key));
      if (door.kind !== 'bucket') throw refused();
      bucketLib.kv(door.bucket, store()).removeItem(key);
      await persist();
    },
    async moveInPrefix(prefix) {
      if (door.kind !== 'bucket') return;
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
 * Open this identity's bucket with the key - or seal a new, empty one the first time (no press).
 * onPress: the key is waiting for the press (the soft key's is the app's to give).
 */
export async function openIdentityBucket(identity: string, okcrypto: Okcrypto, onPress?: () => void): Promise<{created: boolean}> {
  const text = await AsyncStorage.getItem(KEY(identity));
  console.log(`[bucket] ${identity.slice(0, 12)}: ${text ? 'a sealed bucket is stored - the key opens it' : 'none stored - sealing a new one'}`);
  /* the recipient is public: read once here, every later write seals to it with no key and no press */
  const {recipient} = await okcrypto.deviceAge.identity(bucketLib.AGE_LABEL);
  const encrypt = (p: Uint8Array, r: Uint8Array | string) => okcrypto.deviceAge.encrypt(p, r);
  if (!text) {
    door = {kind: 'bucket', identity, bucket: bucketLib.create({owner: identity}), recipient, encrypt, movedPrefixes: new Set()};
    await persist();
    await moveOldRecords();
    return {created: true};
  }
  const {bucket} = await bucketLib.openWithKey(text, {
    owner: identity,
    /*
     * ALWAYS A PRESS (Brad: "a button press here is needed"): 3.1.0's device-custody decrypt asks for one by
     * itself (confirm); the older X-Wing path is a shared-secret derive, asked here in its press-first form
     * (requirePress) - the box key opened the bucket without one before. Either wait says "press".
     */
    decrypt: (age: Uint8Array, label: string) => okcrypto.deviceAge.decrypt(age, label, {requirePress: true, confirm: () => onPress?.(), onKeepAlive: () => onPress?.()}),
  });
  door = {kind: 'bucket', identity, bucket, recipient, encrypt, movedPrefixes: new Set()};
  await moveOldRecords();
  return {created: false};
}

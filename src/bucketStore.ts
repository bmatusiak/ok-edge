/*
 * THIS IDENTITY'S BUCKET, opened by the key (Brad, 2026-10-24: after the identity check's Continue, "a button
 * press here is needed to decrypt the container").
 *
 * One sealed bucket per identity, kept in the app's storage only in its sealed form: an age file to the key's
 * own X-Wing recipient (node-onlykey-lib bucket sealToKey). Opening it is the key's X-Wing step - the key asks
 * for a press - and the opened bucket lives in memory only, until the door closes (a lock, another key).
 * The first time an identity is seen, an empty bucket is sealed for it: sealing needs no key and no press.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as bucketLib from 'node-onlykey-lib/bucket';

type Bucket = ReturnType<typeof bucketLib.create>;
type Okcrypto = {
  deviceAge: {
    identity(label: string): Promise<{recipient: Uint8Array}>;
    encrypt(plaintext: Uint8Array, recipient: Uint8Array | string): Uint8Array;
    decrypt(age: Uint8Array, label: string, opts?: {confirm?: () => void}): Promise<Uint8Array>;
  };
};

const KEY = (identity: string): string => `okedge.bucket.${identity.toLowerCase()}`;
let opened: {identity: string; bucket: Bucket} | null = null;

/** The bucket opened for this session, or null - nothing of it is kept unsealed anywhere else. */
export function openedBucket(): {identity: string; bucket: Bucket} | null {
  return opened;
}

/** The door closed (a lock, another key): the opened bucket goes with it. */
export function closeBucket(): void {
  opened = null;
}

/**
 * Open this identity's bucket with the key - or seal a new, empty one the first time (no press).
 * onPress: the key is waiting for the press (the soft key's is the app's to give).
 */
export async function openIdentityBucket(identity: string, okcrypto: Okcrypto, onPress?: () => void): Promise<{created: boolean}> {
  const text = await AsyncStorage.getItem(KEY(identity));
  console.log(`[bucket] ${identity.slice(0, 12)}: ${text ? 'a sealed bucket is stored - the key opens it' : 'none stored - sealing a new one'}`);
  if (!text) {
    const b = bucketLib.create({owner: identity});
    const {recipient} = await okcrypto.deviceAge.identity(bucketLib.AGE_LABEL);
    await AsyncStorage.setItem(KEY(identity), bucketLib.sealToKey(b, recipient, (p, r) => okcrypto.deviceAge.encrypt(p, r)));
    opened = {identity, bucket: b};
    return {created: true};
  }
  const {bucket} = await bucketLib.openWithKey(text, {
    owner: identity,
    decrypt: (age: Uint8Array, label: string) => okcrypto.deviceAge.decrypt(age, label, {confirm: () => onPress?.()}),
  });
  opened = {identity, bucket};
  return {created: false};
}

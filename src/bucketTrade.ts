/*
 * THE PHONE ANSWERS A BUCKET TRADE (ok-edge plan S3; Brad, 2026-10-25: "the CLI pair is our hook to try and sync with -
 * those are the pre-set-up trusted devices, what we can replicate with").
 *
 * A computer this phone is cli-paired with (only those reach the phone's host over Bluetooth - btTransit) asks to
 * trade buckets after its log swap; this is the peer's side of node-onlykey-lib bucket/src/trade.js, answered from
 * the bucket the identity check opened. Nothing is shown before the computer has proven its bucket identity, and a
 * phone whose bucket is not open refuses the same plain way.
 *
 * THIS PHONE'S PROOF MATERIAL - its bucket key and the certificate - is made once, at the first trade, through this
 * phone's key (its ECDH and its signature: the press sheet asks twice), and kept sealed in the Keystore
 * (NativeSecrets box), per identity and net. Not in the bucket: a bucket holds no secret, and the bucket key is one.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as bucketLib from 'node-onlykey-lib/bucket';
import {bytes as okbytes} from 'node-onlykey-lib';
import NativeSecrets from 'okedge-native/specs/NativeSecrets';
import {saveTradedBucket, tradeBucket} from './bucketStore';
import {getOnlyKey} from './onlykey';
import {activeBackend} from './hooks/KeyContext';
import {currentNet} from './net';

const keychain = require('node-onlykey-lib/keychain');

declare const crypto: {getRandomValues<T extends Uint8Array>(array: T): T};
const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));

/* the store rules the computer uses too (lib bucket/cli/trade.js storeRules) */
const kcRule = bucketLib.rules.keychain(keychain.list);
const RULES = {
  keychain: kcRule, 'keychain-test': kcRule,
  guestbook: bucketLib.rules.guestbook(), 'guestbook-test': bucketLib.rules.guestbook(),
  passwords: bucketLib.rules.passwords(),
};

type Me = {id: string; identityPublicKey: Uint8Array; bucketKey: {secretKey: Uint8Array; publicKey: Uint8Array}; certificate: Uint8Array};
const ALIAS = 'bucketkey';
const KEY = (id: string) => `okrn.bucketkey.${currentNet() === 'test' ? 'test.' : ''}${id}`;
let me: Me | null = null;

/* this phone's bucket key and certificate for the open bucket's identity: kept sealed, or made once */
async function ensureMe(): Promise<void> {
  const open = tradeBucket();
  if (!open) { me = null; return; }
  if (me && me.id === open.identity) return;
  const sealed = await AsyncStorage.getItem(KEY(open.identity));
  if (sealed) {
    const j = JSON.parse(okbytes.fromHex(await NativeSecrets.boxOpen(ALIAS, sealed)).reduce((s: string, c: number) => s + String.fromCharCode(c), ''));
    me = {id: open.identity, identityPublicKey: okbytes.fromHex(j.i), bucketKey: {secretKey: okbytes.fromHex(j.s), publicKey: okbytes.fromHex(j.p)}, certificate: okbytes.fromHex(j.c)};
    return;
  }
  const {okcrypto} = await getOnlyKey(activeBackend());
  const ok = okcrypto as any;
  const identity = await bucketLib.bucketIdentity.readIdentity(ok);
  if (identity.id !== open.identity) { me = null; return; }
  console.log(`[bucket] ${open.identity.slice(0, 12)}: making this phone's bucket key, once - the key asks for two presses`);
  const bucketKey = await bucketLib.bucketIdentity.deriveBucketKey(ok, identity.publicKey);
  const certificate = await bucketLib.bucketIdentity.certify(ok, identity.publicKey, bucketKey.publicKey);
  const text = JSON.stringify({i: okbytes.toHex(identity.publicKey), s: okbytes.toHex(bucketKey.secretKey), p: okbytes.toHex(bucketKey.publicKey), c: okbytes.toHex(certificate)});
  await AsyncStorage.setItem(KEY(open.identity), await NativeSecrets.boxSeal(ALIAS, okbytes.toHex(new TextEncoder().encode(text))));
  me = {id: open.identity, identityPublicKey: identity.publicKey, bucketKey, certificate};
}

const answer = bucketLib.trade.peerSide({
  bucket: () => tradeBucket()?.bucket ?? null,
  me: () => me,
  randomBytes,
  rules: RULES,
});

/** Is this a bucket trade message (bucket/src/trade.js)? */
export function isTradeMessage(msg: any): boolean {
  return (Object.values(bucketLib.trade.TYPES) as string[]).includes(msg?.type);
}

/** Answer one round of a trade from a paired computer. */
export async function handleTrade(msg: any, from: string): Promise<unknown> {
  if (msg.type === bucketLib.trade.TYPES.HELLO) await ensureMe().catch((e: unknown) => { me = null; console.log(`[bucket] no proof material: ${String((e as Error)?.message ?? e)}`); });
  const out: any = answer(msg, from);
  if (msg.type === bucketLib.trade.TYPES.GIVE && out?.ok) {
    await saveTradedBucket();
    const n = Object.values(out.taken || {}).reduce((a: number, b: any) => a + Number(b), 0);
    console.log(`[bucket] traded with a paired computer: took ${n}`);
  }
  if (out && out.ok === false) console.log(`[bucket] a trade was refused (${msg.type})`);
  return out;
}

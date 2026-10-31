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
import {phoneSyncAllowed, phoneSyncChecked, phoneSyncTraded} from './sync';
import {RULES, storeItems} from './bucketRules';
import {saveTradedBucket, tradeBucket} from './bucketStore';
import {getOnlyKey} from './onlykey';
import {activeBackend} from './hooks/KeyContext';
import {currentNet} from './net';
import {ioPulse} from './btActivity';
import {DEVICE_WORD} from './platform';
import {challengeOpts} from './hostChallenge';


declare const crypto: {getRandomValues<T extends Uint8Array>(array: T): T};
const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));

/* the store rules the computer uses too (lib bucket/cli/trade.js storeRules) */

type Me = {id: string; identityPublicKey: Uint8Array; bucketKey: {secretKey: Uint8Array; publicKey: Uint8Array}; certificate: Uint8Array};
const ALIAS = 'bucketkey';
/*
 * THE KEPT COPY NAMES ITS VERSION (lib bucket-identity BUCKET_KEY_VERSION): v2 is derive_secret's derive under the site the
 * key names. A v1 copy (the ECDH, before 2026-10-29) is not read - the bucket key is made again at the next login, and the
 * old copy dropped then; the bucket itself is another thing (bucketStore.ts) and stays as it is.
 */
const KEY = (id: string) => `okrn.bucketkey.v${bucketLib.bucketIdentity.BUCKET_KEY_VERSION}.${currentNet() === 'test' ? 'test.' : ''}${id}`;
const OLD_KEY = (id: string) => `okrn.bucketkey.${currentNet() === 'test' ? 'test.' : ''}${id}`;
let me: Me | null = null;

/* is this device's bucket key for the identity kept already? (the login plan: its certificate is a signature the budget pays) */
export async function proofKept(identity: string): Promise<boolean> {
  return Boolean(await AsyncStorage.getItem(KEY(identity.toLowerCase())));
}

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
  /* the identity plugin's read, held (lib plugins/identity): the same identity the bucket opened for */
  const identity = await (await getOnlyKey(activeBackend())).identity.load();
  if (identity.id !== open.identity) { me = null; return; }
  console.log(`[bucket] ${open.identity.slice(0, 12)}: making this ${DEVICE_WORD}'s bucket key, once - under ${identity.site ?? 'no site'}`);
  /*
   * THE KEY'S OWN SITE, NO OTHER (Brad, 2026-10-29: "we derive by rpid ... no fallback, other domains should not derive the
   * same key"): the derive is touchless, bound to the site the key names (ctap_bridge), the same on every device of the
   * identity; a key that names none has no bucket key here (the lib says so: NO_KEY_SITE).
   */
  /*
   * Touchless is not unasked: the key's derive setting (field 30) decides, and its default is the 3-button code. A
   * hard key cannot show it, so this host does - without it a key that asks the code waited for digits nobody saw,
   * and any press read as a wrong code (CTAP2_ERR_OPERATION_DENIED; key 2, 2026-10-30).
   */
  const made = challengeOpts(`Making this ${DEVICE_WORD}'s bucket key`);
  let bucketKey;
  try { bucketKey = await bucketLib.bucketIdentity.deriveBucketKeyAt(ok, identity.publicKey, identity.site, made.opts); } finally { made.done(); }
  /* the certificate is a signature: a hard key may wait for a 3-button code, which this host shows (hostChallenge.ts) */
  const ask = challengeOpts(`Certifying this ${DEVICE_WORD}'s bucket key`);
  let certificate;
  try { certificate = await bucketLib.bucketIdentity.certify(ok, identity.publicKey, bucketKey.publicKey, ask.opts); } finally { ask.done(); }
  const text = JSON.stringify({i: okbytes.toHex(identity.publicKey), s: okbytes.toHex(bucketKey.secretKey), p: okbytes.toHex(bucketKey.publicKey), c: okbytes.toHex(certificate)});
  await AsyncStorage.setItem(KEY(open.identity), await NativeSecrets.boxSeal(ALIAS, okbytes.toHex(new TextEncoder().encode(text))));
  await AsyncStorage.removeItem(OLD_KEY(open.identity));
  me = {id: open.identity, identityPublicKey: identity.publicKey, bucketKey, certificate};
}

const answer = bucketLib.trade.peerSide({
  bucket: () => tradeBucket()?.bucket ?? null,
  me: () => me,
  randomBytes,
  rules: RULES,
});

/**
 * This device's proof material for the open bucket's identity (made once through the key: a derive and a signature), or null when
 * no bucket is open or the key is another identity's. Joining the identity's room on the user's server needs it first
 * (serverRoom.ts).
 */
export async function proofMaterial(): Promise<Me | null> {
  await ensureMe();
  return me;
}

/** Is this a bucket trade message (bucket/src/trade.js)? */
export function isTradeMessage(msg: any): boolean {
  return (Object.values(bucketLib.trade.TYPES) as string[]).includes(msg?.type);
}

/**
 * Answer one round of a trade from a paired computer.
 * allowed: whether this carrier may trade now - the phone's Bluetooth sync service by default; a room on the user's
 * server passes its own (it was joined with the key's proof, and is left when the bucket closes).
 */
export async function handleTrade(msg: any, from: string, {allowed = phoneSyncAllowed}: {allowed?: () => boolean} = {}): Promise<unknown> {
  console.log(`[bucket] ${msg.type} arrived (${JSON.stringify(msg).length} bytes)`);
  /* the ⇄ flashes for every trade message this device answers - over Bluetooth or the server's room alike */
  ioPulse('sync');
  /* the Sync tab's switch off, or no bucket open: the same plain refusal as any other (no hint about the bucket) */
  if (!allowed()) { console.log(`[bucket] ${msg.type}: refused (sync is off here)`); return {ok: false, refusal: 'no'}; }
  if (msg.type === bucketLib.trade.TYPES.HELLO) await ensureMe().catch((e: unknown) => { me = null; console.log(`[bucket] no proof material: ${String((e as Error)?.message ?? e)}`); });
  let out: any;
  try {
    out = answer(msg, from);
    /* the trade's steps, in the app log (types and counts only - a GIVE's values are never logged) */
    console.log(`[bucket] ${msg.type}: ${out?.ok ? 'answered' : 'refused'}${out?.taken ? ` - took ${JSON.stringify(out.taken)}` : ''}`);
  } catch (e) {
    /* said here: the computer only learns that no answer came (the box, 2026-10-25: a give that vanished silently) */
    console.log(`[bucket] a trade message failed (${msg.type}): ${String((e as Error)?.stack ?? e).slice(0, 400)}`);
    throw e;
  }
  /* a check answered: the two states compared, and each feature as it is here - for the Sync tab (src/sync.ts) */
  if (msg.type === bucketLib.trade.TYPES.PROVE && out?.ok && out.state && msg.state) {
    const b = tradeBucket()?.bucket;
    const differs: string[] = bucketLib.replicate.differs(out.state, msg.state);
    const stores: Record<string, {items: number; same: boolean}> = {};
    if (b) for (const [name, items] of Object.entries(storeItems(b))) stores[name] = {items, same: !differs.includes(name)};
    phoneSyncChecked(out.state.hash === msg.state.hash, stores);
  }
  if (msg.type === bucketLib.trade.TYPES.GIVE && out?.ok) {
    await saveTradedBucket().catch((e: unknown) => { console.log(`[bucket] the traded bucket was not stored: ${String((e as Error)?.message ?? e)}`); throw e; });
    const n = Object.values(out.taken || {}).reduce((a: number, b: any) => a + Number(b), 0);
    console.log(`[bucket] traded with a paired computer: took ${n}`);
    /* the Sync tab's state - and through it, a screen holding a decrypted copy of a changed store asks to decrypt again */
    const b = tradeBucket()?.bucket;
    phoneSyncTraded(out.taken || {}, b ? storeItems(b) : {});
  }
  if (out && out.ok === false) console.log(`[bucket] a trade was refused (${msg.type})`);
  return out;
}

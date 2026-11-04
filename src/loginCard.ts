/*
 * THIS DEVICE'S LOGIN CARD in the app (Brad, 2026-10-30: "manual multi press flow for initial login decryption to get into
 * the app, then a edge certify that produce a bucket login agent identity card that has the bucket identity the manual
 * flow used, then we keep a copy of the cert with the bucket, then the card can be rebuilt with cert and used for 1 press
 * login after"; one card per salted device id; "a signup flow that recognizes no identity on the device/mcp exist").
 *
 * Where it lives (lib edge/src/certify.js record):
 *   the identity bucket's store `edge-cards` (`edge-cards-test`), keyed by device id - synced, every device lists it
 *   a copy on this host, edgeKey('card.<identity>.<device>') - what the next login reads before any bucket is open
 *
 * After a login that ran manually (no card here), afterLogin waits for the bucket's first sync (serverRoom), then takes
 * this device's card from the bucket into the local copy - or, when the bucket has none, offers to make it (the
 * LoginCardSheet: one press certifies it). Looked for only after that sync: an empty bucket of a new host would
 * otherwise read as "no card" and certify this device a second time.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {currentNet, edgeKey} from './net';

/* top: the newest checkpoint and the links after it (lib certify.top) - beside the owner-signed part, rebuilt without a press */
/* gate: the checkpoint's gate token (WARM_GATE firmware) - with it a top may have no head (a host that never held the chain) */
export type CardTop = {checkpoint: {seq: number; head?: string; signature?: string; signaturePq?: string; gate?: string}; links: string[]};
export type CardRecord = {v: number; kind: 'login-card'; thing: {device: string; identity: string; site: string}; certification: Record<string, unknown>; top?: CardTop};

const CARDS = (): string => (currentNet() === 'test' ? 'edge-cards-test' : 'edge-cards');
const LOCAL = (identity: string, device: string): string => edgeKey(`card.${identity.toLowerCase()}.${device.toLowerCase()}`);

/** The card this host keeps for this identity and device, or null. */
export async function localCard(identity: string, device: string): Promise<CardRecord | null> {
  try {
    const r = JSON.parse((await AsyncStorage.getItem(LOCAL(identity, device))) || 'null');
    return r && r.kind === 'login-card' && r.thing?.device === device.toLowerCase() ? r : null;
  } catch {
    return null;
  }
}

/* this device's card in the open bucket, or null */
async function bucketCard(device: string): Promise<CardRecord | null> {
  const entries = await require('./bucketStore').storeEntries(CARDS());
  const t = entries?.[device.toLowerCase()];
  if (!t) return null;
  try { return JSON.parse(t); } catch { return null; }
}

/* a certified card: into the bucket (synced) and the local copy */
async function fileCard(identity: string, rec: CardRecord): Promise<void> {
  await require('./bucketStore').writeEntries(CARDS(), {[rec.thing.device]: JSON.stringify(rec)});
  await AsyncStorage.setItem(LOCAL(identity, rec.thing.device), JSON.stringify(rec));
  require('./serverRoom').bucketChanged();
}

/* this key's cards kept on this host (one per identity) */
async function localCards(device: string): Promise<{key: string; rec: CardRecord}[]> {
  const suffix = `.${device.toLowerCase()}`;
  const keys = (await AsyncStorage.getAllKeys()).filter(k => k.startsWith(edgeKey('card.')) && k.endsWith(suffix));
  const out: {key: string; rec: CardRecord}[] = [];
  for (const key of keys) {
    try {
      const rec = JSON.parse((await AsyncStorage.getItem(key)) || 'null');
      if (rec?.kind === 'login-card' && rec.thing?.device === device.toLowerCase()) out.push({key, rec});
    } catch { /* not a card */ }
  }
  return out;
}

/**
 * THE TOP TO WARM EDGE FROM (SoftKeyEdge.warmUp): the newest top among this key's cards - the local copies, and the open
 * bucket's (a new browser has only that one, after the login opened the bucket) - or null.
 */
export async function cardTop(device: string): Promise<CardTop | null> {
  const tops = (await localCards(device)).map(c => c.rec.top);
  tops.push((await bucketCard(device).catch(() => null))?.top);
  const have = tops.filter((t): t is CardTop => !!t?.checkpoint);
  return have.sort((a, b) => b.checkpoint.seq - a.checkpoint.seq)[0] ?? null;
}

/**
 * A NEWER TOP FOR THIS KEY'S CARD (Brad, 2026-10-31: "keep our login card updated with a good checkpoint to provide
 * edge warmup"): with each filing of the key's log (edgeSoftKey.fileOwnLog, on the encrypted bucket's sync), into the
 * bucket's card and the local copies - only when it is newer. A key with no card yet has nowhere to carry it.
 */
export async function fileTop(device: string, top: CardTop): Promise<boolean> {
  const inBucket = await bucketCard(device).catch(() => null);
  /* newer: a later checkpoint; at the same one, more links after it, or the gate token the kept one lacks */
  const newer = (rec: CardRecord | null) => !!rec && (!rec.top || rec.top.checkpoint.seq < top.checkpoint.seq ||
    (rec.top.checkpoint.seq === top.checkpoint.seq && (rec.top.links.length < top.links.length || (!rec.top.checkpoint.gate && !!top.checkpoint.gate))));
  let filed = false;
  if (newer(inBucket)) {
    await require('./bucketStore').writeEntries(CARDS(), {[device.toLowerCase()]: JSON.stringify({...inBucket, top})});
    filed = true;
  }
  for (const c of await localCards(device)) {
    if (newer(c.rec)) { await AsyncStorage.setItem(c.key, JSON.stringify({...c.rec, top})); filed = true; }
  }
  return filed;
}

/* ---------------------------------------------------------------- the offer (LoginCardSheet) */

export type CardOffer = {identity: string; device: string; state: 'offered' | 'certifying' | 'pressing' | 'failed'; why?: string} | null;
let offer: CardOffer = null;
const listeners = new Set<(o: CardOffer) => void>();
const setOffer = (o: CardOffer) => { offer = o; for (const l of [...listeners]) l(o); };
export const cardOffer = () => offer;
export function onCardOffer(l: (o: CardOffer) => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/**
 * After a login with no card here: the bucket's first sync, then this device's card into the local copy - or the offer
 * to make it. Runs once per login; nothing asked of the key until the person says Make it.
 */
export async function afterLogin(identity: string, device: string): Promise<void> {
  if (await localCard(identity, device)) return;
  /* bounded: a server that never answers does not keep the offer away for good */
  await Promise.race([require('./serverRoom').afterFirstSync(), new Promise<void>(r => setTimeout(r, 60_000))]);
  const inBucket = await bucketCard(device);
  if (inBucket) {
    await AsyncStorage.setItem(LOCAL(identity, device), JSON.stringify(inBucket));
    console.log(`[card] this device's login card taken from the bucket (${device.slice(0, 8)})`);
    return;
  }
  console.log(`[card] this device (${device.slice(0, 8)}) has no login card yet - offered`);
  setOffer({identity, device, state: 'offered'});
}

/** Make it: the key certifies this device's card at a press; filed in the bucket and kept here. */
export function makeCard(): Promise<void> {
  /* what the key work is for, on the "Working with your key" sheet (keyBusy keyTask) */
  return require('./keyBusy').keyTask(`Making this ${require('./platform').DEVICE_WORD}'s login card`, makeCardNow);
}
async function makeCardNow(): Promise<void> {
  const o = offer;
  if (!o) return;
  setOffer({...o, state: 'certifying'});
  try {
    const {identity} = await require('./onlykey').getOnlyKey(require('./hooks/KeyContext').activeBackend());
    /* the certify's press says why from the moment the key waits (hostChallenge expectPress; LoginCardSheet's ask after it) */
    require('./hostChallenge').expectPress(`Certify this ${require('./platform').DEVICE_WORD}'s login card - after this, one press logs in here`);
    const rec = await (identity as any).certifyLoginCard({onPress: () => setOffer({...o, state: 'pressing'})});
    await fileCard(o.identity, rec);
    console.log(`[card] this device's login card certified at #${rec.certification.seq} and filed`);
    /* its link into this copy now, while the session still welds it (as after a card login - IdentityCheckScreen) */
    try {
      const s = await require('./edgeSoftKey').SoftKeyEdge.open();
      /* the certify's gate token into the card's top first: a host with none of the chain warms from it (WARM_GATE) */
      if (s) await require('./edgeSoftKey').fileCardTopNow(s).catch((e: unknown) => console.log(`[card] top not filed - ${String((e as Error)?.message ?? e)}`));
      if (s) await require('./edgeStore').sync(s);
    } catch (e: unknown) {
      console.log(`[card] the card's link is NOT in this copy yet - ${String((e as Error)?.message ?? e)}`);
    }
    setOffer(null);
  } catch (e: unknown) {
    setOffer({...o, state: 'failed', why: String((e as Error)?.message ?? e)});
  }
}

/**
 * THE CARD IS STALE (lib identity.login: `stale` - the login asked something the card does not name, or not something
 * it does; Brad, 2026-11-01: "login flow and budget use count need to match"): a new card is offered, made from the last
 * manual login's record (identity.loginRecord - the next login runs manually until it is made, so the record is fresh).
 */
export function offerNewCard(identity: string, device: string): void {
  console.log(`[card] this device's login card (${device.slice(0, 8)}) no longer matches its login - a new one offered`);
  setOffer({identity, device, state: 'offered', why: 'the login changed since this card was made'});
}

/*
 * EDGE NOT ENABLED HERE (WARM_GATE; Brad, 2026-11-01: "the login identity card holds cold boot for edge to warm up - if
 * the key has no identity on the mcp/webapp it creates one there"): a host that holds none of the chain, with no card
 * top whose gate token the key takes, gets the card offered again - its certify (a press) carries a fresh token, filed
 * as the card's top at once (makeCard), and Edge warms from it. Once per session for each key.
 */
const gateOffered = new Set<string>();
export function offerCardForGate(identity: string, device: string, why: string): void {
  const k = `${identity.toLowerCase()}:${device.toLowerCase()}`;
  if (gateOffered.has(k) || offer) return;
  gateOffered.add(k);
  console.log(`[card] Edge is not enabled on this host (${why}) - the login card offered again: one press, and its checkpoint enables Edge here`);
  setOffer({identity, device, state: 'offered', why: 'Edge needs a recent checkpoint of this key on this device: certify the card once (a press) and Edge is enabled here'});
}

/** Not now: the next login runs manually again, and offers it again. */
export function dismissCardOffer(): void {
  setOffer(null);
}

/* the key forgotten (a lock, an unplug, the Log in page - its identity plugin): this, which stays loaded, lets go of it */
require('./onlykey').onKeyForgotten(() => dismissCardOffer());

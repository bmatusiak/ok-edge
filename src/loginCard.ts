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

export type CardRecord = {v: number; kind: 'login-card'; thing: {device: string; identity: string; site: string}; certification: Record<string, unknown>};

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
export async function makeCard(): Promise<void> {
  const o = offer;
  if (!o) return;
  setOffer({...o, state: 'certifying'});
  try {
    const {identity} = await require('./onlykey').getOnlyKey(require('./hooks/KeyContext').activeBackend());
    const rec = await (identity as any).certifyLoginCard({onPress: () => setOffer({...o, state: 'pressing'})});
    await fileCard(o.identity, rec);
    console.log(`[card] this device's login card certified at #${rec.certification.seq} and filed`);
    setOffer(null);
  } catch (e: unknown) {
    setOffer({...o, state: 'failed', why: String((e as Error)?.message ?? e)});
  }
}

/** Not now: the next login runs manually again, and offers it again. */
export function dismissCardOffer(): void {
  setOffer(null);
}

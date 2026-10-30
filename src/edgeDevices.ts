/*
 * YOUR DEVICES, THIS PHONE'S NAMETAG, AND THE LOGS HELD FOR YOUR APPROVAL (Brad, 2026-10-08).
 *
 *   "pairing and sync is all app stuff, not firmware"
 *   "if it has the private ecc key to sign the block, then i want the log"
 *   "the approve sheet should not be displayed automatically ... a banner at the top of edge
 *    tab to open it"; "we should hold these blocks in the app until approved and merged"
 *   a device gives "its own name for its device fingerprint in the block" - its NAMETAG;
 *   "find a way to fix multi names for the same device"; "so its not 'unknown'".
 *
 * A computer you approved for Bluetooth offers another device's log (lib sync OFFER): its
 * links up to its key's signed checkpoint and its owner statement. The phone HOLDS it here -
 * nothing merges, no sheet pops up. The Edge tab shows a banner; its sheet lists each held
 * device, sorted by the lib (devices.classify, with THIS key's owner key):
 *   mine-known  merged on Approve
 *   mine-new    "A device made with your OnlyKey appeared - is it yours?": Yes merges it and
 *               adds it to your devices; No raises the LEAK alarm (kept as evidence)
 *   forged      never merged; kept as evidence against the computer that sent it
 * Decline keeps a log out of your view but stored. The device's nametag comes from its own
 * signed statement - the highest seq wins, older ones stay as history - so there is one
 * name per fingerprint and never 'unknown'.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {devices as devicesLib, grants as grantsLib, sync as syncLib} from 'node-onlykey-lib/edge';
import {fromHex, toHex} from 'node-onlykey-lib/bytes';
import NativeEdgeAlert from 'okedge-native/specs/NativeEdgeAlert';
import {keepMerged, loadMirror} from './edgeStore';
import type {EdgeLinkRecord} from './edge/types';
import {currentNet, edgeKey, netTag} from './net';

const DEVICES = (): string => edgeKey('devices');
/*
 * ONE STATEMENT PER DEVICE (box + Pixel, 2026-10-24: a hard key plugged into the Pixel was shown as "Pixel 6a" - the
 * phone kept ONE statement, so another key's re-sign wrote over the soft key's, and the phone's owner key flipped
 * to the hard key's identity while it was plugged in). Each key's statement is kept under its own device id;
 * "this device" is the key the app is using now (setCurrentDevice, from SoftKeyEdge.open).
 *
 * KEPT IN ONE PLACE, THE IDENTITY BUCKET (Brad, 2026-10-30: "the your devices section is the list of signed nametags,
 * cant be removed from edge, it syncs with edge"): the `edge-logs` store's `<dev>.statement` - the key the CLI files
 * (edge/cli/nametag.js), every device's log carries (lib logblocks) and every trade moves. This app kept its own copy
 * in plain storage before, so a nametag set on one host never showed on another (the desktop's "Your devices" read
 * none while the bucket held three).
 */
const LOGS = (): string => (currentNet() === 'test' ? 'edge-logs-test' : 'edge-logs');
/*
 * EVERY NAMETAG A KEY SIGNED (Brad, 2026-10-30: "each KEY has its own row, and in that row, show all the name tags that
 * KEY has signed, so if a key name is changed i can see the old names it had"). The log's `<dev>.statement` holds only
 * the newest (lib logblocks merges it by seq), so each statement is also kept here, once, under its own key
 * `<dev>.<its signature's first 16 hex>` - written once and never changed, so every trade's per-key merge is their union.
 */
const NAMES = (): string => (currentNet() === 'test' ? 'edge-names-test' : 'edge-names');
const statementKey = (deviceIdHex: string): string => `${deviceIdHex.slice(0, 16).toLowerCase()}.statement`;
/* one <dev>.statement value -> the statement it holds, or null */
function statementIn(text: string | undefined): StoredStatement | null {
  if (!text) return null;
  try {
    const s = JSON.parse(text).statement;
    return s && s.deviceId && s.nametag ? (s as StoredStatement) : null;
  } catch {
    return null;
  }
}
const logEntries = (): Promise<Record<string, string> | null> => require('./bucketStore').storeEntries(LOGS());
let currentDevice: string | null = null;
let currentIsHard = false;
export function setCurrentDevice(deviceIdHex: string, backend?: string): void {
  currentDevice = deviceIdHex.toLowerCase();
  currentIsHard = backend === 'usb';
}
/** The device id (16 bytes, hex) of the key the app is using now, named or not - null before Edge opened it. */
export function currentDeviceId(): string | null {
  return currentDevice;
}
const HELD = (): string => edgeKey('held');

/*
 * HYBRID STATEMENTS (lib grants.verifyStatement; Brad, 2026-10-10): the key signs a statement
 * with its owner key AND the owner key's ML-DSA-65 twin, over its device id and BOTH checkpoint
 * keys (publicKey, publicKeyPq). Both signatures must verify under this phone's own owner keys
 * (ownerKey, ownerKeyPq), and a device is "mine" only when its statement's publicKeyPq is the
 * one its log is checked with (devices.classify). Statements stay fully hybrid - unlike older
 * checkpoints, nothing welds a statement to a newer one. No fallback: a statement stored
 * without its ML-DSA-65 half no longer verifies (Edge is unreleased).
 */
/** A statement as stored (hex), and as the lib takes it (bytes). */
export type StoredStatement = {
  deviceId: string; publicKey: string; publicKeyPq: string; seq: number | null; nametag: string; signature: string; signaturePq: string;
  ownerKey?: string; ownerKeyPq?: string;
};
export type Statement = {deviceId: Uint8Array; publicKey: Uint8Array; publicKeyPq: Uint8Array; seq: number | null; nametag: string; signature: Uint8Array; signaturePq: Uint8Array};
/** One of your devices, as lib devices.remember keeps it. */
export type Device = {deviceId: string; publicKey: string; publicKeyPq: string; since: number; statements: {seq: number | null; nametag: string; signature: string; signaturePq: string}[]};
/** A log held for your approval. */
export type HeldLog = {
  deviceId: string;
  publicKey: string;
  from: string;
  at: number;
  /* the budgets' opening words it came with - checked against the log only at the merge (2026-10-09) */
  openings?: unknown[];
  /* its notes: {reasons: {seq: text}, messages: {seq: text}} - checked against the chain where shown */
  notes?: {reasons?: Record<string, string>; messages?: Record<string, string>; seen?: Record<string, number>} | null;
  /* its checkpoint key's ML-DSA-65 twin, as its statement names it */
  publicKeyPq: string;
  records: [string, string, string | null][];
  /* that log's newest checkpoint: both halves (its one hybrid anchor) */
  checkpoint: {seq: number; head: string; signature: string; signaturePq: string};
  statement: StoredStatement;
};
/** One log a computer brought, judged: whose it is, whether its chain checks, what words are missing. */
export type HeldView = {complete: boolean; missing: string[]; deviceId: string; nametag: string | null; claimed: string; class: 'mine-known' | 'mine-new' | 'forged'; count: number; from: string; at: number; checkOk: boolean; alarm: string | null};

/* a missing half reads as empty bytes: it fails every check (no fallback) */
const bytesOf = (h: string | undefined | null) => fromHex(h ?? '');
const hexOf = (b: Uint8Array | undefined | null) => (b ? toHex(b) : '');
const toStatement = (s: StoredStatement): Statement => ({
  deviceId: fromHex(s.deviceId), publicKey: fromHex(s.publicKey), publicKeyPq: bytesOf(s.publicKeyPq), seq: s.seq ?? null, nametag: s.nametag,
  signature: fromHex(s.signature), signaturePq: bytesOf(s.signaturePq),
});
const store = (s: Statement & {ownerKey?: Uint8Array; ownerKeyPq?: Uint8Array}): StoredStatement => ({
  deviceId: toHex(s.deviceId), publicKey: toHex(s.publicKey), publicKeyPq: hexOf(s.publicKeyPq), seq: s.seq ?? null, nametag: s.nametag,
  signature: toHex(s.signature), signaturePq: hexOf(s.signaturePq),
  ...(s.ownerKey ? {ownerKey: toHex(s.ownerKey)} : {}),
  ...(s.ownerKeyPq ? {ownerKeyPq: toHex(s.ownerKeyPq)} : {}),
});

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/* ------------------------------------------------ this phone */

/** A key's signed nametag statement in the bucket - by default the key the app is using now - or null: none set (UNNAMED), or no bucket open. */
export async function ownStatement(deviceIdHex: string | null = currentDevice): Promise<StoredStatement | null> {
  if (!deviceIdHex) return null;
  const entries = await logEntries();
  return entries ? statementIn(entries[statementKey(deviceIdHex)]) : null;
}

/**
 * This key's owner public keys: the P-256 one (X||Y) and its ML-DSA-65 twin (1952 bytes), as the key gives them when
 * it signs a statement - asked once a session per device (no press, no link), held in memory only.
 *
 * THE OWNER KEY IS THE KEY'S, NOT STORAGE'S (Brad, 2026-10-11: "checking every field in a token means nothing if we
 * never check the signature"): every other device's nametag and log is judged against it, so it comes from the key.
 * It does not need a nametag of this device's own (until 2026-10-30 it was read from this device's stored statement,
 * and an UNNAMED device could judge nothing - "name this device first"): the statement asked for here is over the
 * nametag this device has, or the word UNNAMED, and is never kept - only the owner keys it carries are.
 */
const owners = new Map<string, {ownerKey: Uint8Array; ownerKeyPq: Uint8Array}>();
export async function ownerKey(soft?: {statement(nametag: string): Promise<any>} | null): Promise<{ownerKey: Uint8Array; ownerKeyPq: Uint8Array} | null> {
  const dev = currentDevice;
  if (!dev) return null;
  const held = owners.get(dev);
  if (held) return held;
  try {
    /*
     * the Edge source already open when the caller has one (SoftKeyEdge.takeShared, Pixel 2026-10-29): opening another
     * runs takeShared again, which asks this again - a loop that never returned and asked the key on every turn
     */
    const src = soft ?? await require('./edgeSoftKey').SoftKeyEdge.open();
    if (!src) return null;
    const st = await src.statement((await ownStatement(dev))?.nametag ?? UNNAMED);
    if (!(st?.ownerKey?.length && st.ownerKeyPq?.length) || !grantsLib.verifyStatement(st, st.ownerKey, st.ownerKeyPq)) {
      console.log("[edge] the key's statement does not verify with the owner keys it names - none used");
      return null;
    }
    const o = {ownerKey: st.ownerKey as Uint8Array, ownerKeyPq: st.ownerKeyPq as Uint8Array};
    owners.set(dev, o);
    return o;
  } catch {
    return null;
  }
}

/**
 * Set this device's nametag: the key signs it with its owner key (no press, no link) and the statement goes into the
 * identity bucket under this device - from there every trade carries it to your other devices and the CLI.
 */
export async function setNametag(soft: {statement(nametag: string): Promise<any>}, nametag: string): Promise<StoredStatement> {
  const st = await soft.statement(nametag);
  const s = store(st);
  if (st.ownerKey?.length && st.ownerKeyPq?.length) owners.set(s.deviceId.toLowerCase(), {ownerKey: st.ownerKey, ownerKeyPq: st.ownerKeyPq});
  const entries = await logEntries();
  if (!entries) throw new Error('no bucket is open here - log in first');
  /* the shape lib logblocks files a device's statement in (its split of a copy) */
  const {ownerKey: _ok, ownerKeyPq: _okPq, ...signed} = s;
  const {writeEntries} = require('./bucketStore');
  await writeEntries(LOGS(), {[statementKey(s.deviceId)]: JSON.stringify({v: 1, deviceId: s.deviceId, statement: signed})});
  /* and into the key's history of names (at: when it was set here - unsigned, it only orders two names signed at one seq) */
  await writeEntries(NAMES(), {[`${statementKey(s.deviceId).slice(0, 16)}.${s.signature.slice(0, 16).toLowerCase()}`]: JSON.stringify({v: 1, deviceId: s.deviceId, statement: signed, at: Date.now()})});
  /* the bucket changed: traded with the devices in the room now, not at the next join */
  require('./serverRoom').bucketChanged();
  notify();
  return s;
}

/*
 * WHAT A DEVICE WITHOUT A NAMETAG IS CALLED, everywhere Edge names a device (Brad, 2026-10-30: "edge should only use
 * NAMETAGS, it should show up as UNNAMED if not") - never a device id, a platform word or a probed name in its place.
 */
export const UNNAMED = 'UNNAMED';
export const nametagOr = (nametag: string | null | undefined) => nametag || UNNAMED;

/**
 * The phone's own device name (its Bluetooth name, e.g. "Bradley's A13"), or '' when it cannot be read. Only ever
 * OFFERED: the nametag dialog fills it in for the person to keep or change (YourDevicesCard) - never signed by itself.
 */
export async function deviceName(): Promise<string> {
  try {
    const NativeBtKeyboard = require('okedge-native/specs/NativeBtKeyboard').default;
    return String((await NativeBtKeyboard.localName()) ?? '').trim().slice(0, 64);
  } catch {
    return '';
  }
}

/**
 * THE NAMETAG THE PERSON SET, KEPT CURRENT -> this device's statement, or null (none set, or no key).
 *
 * THE PERSON SETS IT, NOTHING ELSE DOES (Brad, 2026-10-30: "if a nametag is unset for the edge key, dont set the
 * device name based on probing, the user set the nametag"): a device with no nametag stays without one - UNNAMED -
 * until the person sets it in Edge Management, where the probed device name is offered to keep or replace. (Until
 * then the phone signed its Bluetooth name as a default the first time one was needed - 2026-10-08 - and a hard key
 * was left unnamed; now every key is the same.) Only an existing nametag is signed again here, below.
 */
export async function refreshNametag(soft: {statement(nametag: string): Promise<any>; deviceId?: Uint8Array; backend?: string} | null): Promise<StoredStatement | null> {
  const have = await ownStatement(soft?.deviceId ? toHex(soft.deviceId) : currentDevice);
  /*
   * A STATEMENT FOR ANOTHER CHAIN IS SIGNED AGAIN (2026-10-08, walking the setup flow): after the
   * key's Edge region was reset (or restored - a new device id), the phone kept giving the old
   * chain's statement, and every computer refused it ("the statement does not name this device"),
   * so this phone's log was never offered to your other devices. Same nametag, this chain.
   */
  /*
   * A STATEMENT WITHOUT ITS ML-DSA HALF IS SIGNED AGAIN too (2026-10-10, the hybrid signatures): one
   * signed before the key made hybrid statements has no publicKeyPq / signaturePq, so a computer
   * refuses it the same way and this phone's log is not offered. Same nametag, both halves.
   */
  const stale = have && (!have.publicKeyPq || !have.signaturePq);
  if (have && soft && (stale || (soft.deviceId && have.deviceId.toLowerCase() !== toHex(soft.deviceId).toLowerCase()))) {
    try {
      return await setNametag(soft, have.nametag);
    } catch {
      return null;
    }
  }
  return have;
}

/* ------------------------------------------------ your devices */

export async function loadDevices(): Promise<Device[]> {
  return readJson<Device[]>(DEVICES(), []);
}

/** A device's signed nametag in the bucket, judged under this key's owner key: its nametag, or null (none, or not this key's). */
export async function nametagOf(d: {deviceId: string}): Promise<{nametag: string} | null> {
  const n = (await signedNametags({withOwn: true})).find(x => x.deviceId === d.deviceId.toLowerCase());
  return n?.nametag ? {nametag: n.nametag} : null;
}
/** Every nametag this device's key signed, newest first (the first is its nametag now) - [] when none. */
export async function ownNames(): Promise<string[]> {
  const dev = currentDevice;
  return dev ? (await signedNametags({withOwn: true})).find(n => n.deviceId === dev)?.names ?? [] : [];
}

/**
 * YOUR DEVICES: every device of this key whose signed nametag the identity bucket holds, this one left out (Brad,
 * 2026-10-30: "the your devices section is the list of signed nametags, cant be removed from edge, it syncs with
 * edge"). A statement counts when both its signatures verify under THIS key's owner keys (grants.verifyStatement) -
 * one another key signed is not yours, and is not listed. There is nothing to forget: the list is what the bucket holds.
 *
 * A KEY WITH NO NAMETAG IS LISTED TOO, as UNNAMED (Brad, 2026-10-30: "your devices section also needs to show UNNAMED keys,
 * until they are named"): every key whose log this identity's bucket holds (its <dev>.meta) - only this identity's key
 * opens that bucket, so a log in it is one of yours - with nametag null until a signed one arrives.
 */
export type SignedNametags = {deviceId: string; nametag: string | null; names: string[]; publicKey: string; publicKeyPq: string};
export async function signedNametags(o: {withOwn?: boolean} = {}): Promise<SignedNametags[]> {
  const entries = await logEntries();
  if (!entries) return [];
  const owner = await ownerKey();
  if (!owner) return [];
  const mine = (s: StoredStatement | null): s is StoredStatement => !!s && grantsLib.verifyStatement(toStatement(s), owner.ownerKey, owner.ownerKeyPq);
  /* each key's statements: its newest in the log, and every one in its history of names */
  const byDev = new Map<string, {now: StoredStatement | null; all: {s: StoredStatement; at: number}[]}>();
  const of = (dev: string) => byDev.get(dev) ?? (byDev.set(dev, {now: null, all: []}), byDev.get(dev)!);
  for (const [k, v] of Object.entries(entries)) {
    if (!k.endsWith('.statement')) continue;
    const s = statementIn(v);
    if (mine(s)) of(s.deviceId.toLowerCase()).now = s;
  }
  for (const v of Object.values((await require('./bucketStore').storeEntries(NAMES())) ?? {}) as string[]) {
    const s = statementIn(v);
    if (!mine(s)) continue;
    let at = 0;
    try { at = Number(JSON.parse(v).at) || 0; } catch { /* no time: ordered by its seq alone */ }
    of(s.deviceId.toLowerCase()).all.push({s, at});
  }
  const out: SignedNametags[] = [];
  for (const [dev, {now, all}] of byDev) {
    if (!o.withOwn && dev === currentDevice) continue;
    /* newest first: by the key's seq when signed, then by when it was set; the log's own newest leads */
    const sorted = all.sort((a, b) => (b.s.seq ?? -1) - (a.s.seq ?? -1) || b.at - a.at).map(x => x.s);
    const head = now ?? sorted[0];
    const names = [head.nametag, ...sorted.map(s => s.nametag)].filter((n, i, a) => a.indexOf(n) === i);
    out.push({deviceId: dev, nametag: head.nametag, names, publicKey: head.publicKey, publicKeyPq: head.publicKeyPq});
  }
  for (const [k, v] of Object.entries(entries)) {
    if (!k.endsWith('.meta')) continue;
    let id = '';
    try { id = String(JSON.parse(v).deviceId ?? '').toLowerCase(); } catch { continue; }
    if (!id || byDev.has(id) || (!o.withOwn && id === currentDevice)) continue;
    let keys: {publicKey?: string; publicKeyPq?: string} = {};
    try { keys = JSON.parse(entries[`${k.slice(0, -5)}.keys`] ?? '{}'); } catch { /* none filed yet */ }
    out.push({deviceId: id, nametag: null, names: [], publicKey: keys.publicKey ?? '', publicKeyPq: keys.publicKeyPq ?? ''});
  }
  /* named keys by name, then the unnamed ones */
  return out.sort((a, b) => (a.nametag === null ? 1 : 0) - (b.nametag === null ? 1 : 0) || (a.nametag ?? a.deviceId).localeCompare(b.nametag ?? b.deviceId));
}

/* ------------------------------------------------ held logs */

export async function loadHeld(): Promise<HeldLog[]> {
  return readJson<HeldLog[]>(HELD(), []);
}
async function saveHeld(list: HeldLog[]): Promise<void> {
  await AsyncStorage.setItem(HELD(), JSON.stringify(list));
  notify();
}

/*
 * ------------------------------------------------ new in your log (to notice and review - never a gate)
 *
 * Brad, 2026-10-24: "i should not be asked to merge anything.. i should just open a log and see
 * everything"; "a way to NOTICE and REVIEW what gets merged ... approve what i see, as in, i
 * confirmed i seen it". A log merges the moment its signatures check; this list only says what
 * came in, and "Seen" is your word that you looked. It never holds anything back.
 */
export type NewItem = {deviceId: string; nametag: string; links: number; from: string; at: number; newDevice: boolean; missing: string[]; warning: string | null};
const NEWS = (): string => edgeKey('newInLog');

/*
 * ONLY WARNINGS (Brad, 2026-10-30: "the notification about new nametags can be removed"): a log that merged is not a
 * notice - it is in the log, under its key's row in Your devices. A log that did not check still is. Rows kept from
 * before that say only "new" are not shown.
 */
export async function loadNew(): Promise<NewItem[]> {
  return (await readJson<NewItem[]>(NEWS(), [])).filter(n => n.warning);
}

/* one row per device: a later arrival before you looked adds to that row; its warning is the latest arrival's (merged now = an older warning cleared) */
async function addNew(item: NewItem): Promise<void> {
  const list = await loadNew();
  const was = list.find(n => n.deviceId === item.deviceId);
  const row = was ? {...item, links: was.links + item.links, newDevice: was.newDevice || item.newDevice, warning: item.warning} : item;
  await AsyncStorage.setItem(NEWS(), JSON.stringify([row, ...list.filter(n => n.deviceId !== item.deviceId)]));
  notify();
}

/** "Seen": you looked at what came in from that device (or from all, with no device). */
export async function markSeen(deviceId?: string): Promise<void> {
  const list = deviceId ? (await loadNew()).filter(n => n.deviceId !== deviceId.toLowerCase()) : [];
  await AsyncStorage.setItem(NEWS(), JSON.stringify(list));
  notify();
}

/**
 * A log a computer brought (another device of your key: a hard key, another phone). Its
 * signatures checked here (devices.classify with THIS key's owner key - the statement, the
 * chain, the checkpoint): merged at once and listed as new. One that does not check is never
 * merged: kept apart and listed as a warning - a finding, not a question. -> {held, count}
 * (`held`: whether anything new came, the reply the computer prints).
 */
export async function receiveLog(o: {deviceId: Uint8Array; publicKey: Uint8Array; publicKeyPq: Uint8Array; records: EdgeLinkRecord[]; checkpoint: {seq: number; head: Uint8Array; signature: Uint8Array; signaturePq: Uint8Array}; statement: Statement; from: string; openings?: unknown[]; notes?: HeldLog['notes']}, now = Date.now()): Promise<{held: boolean; count: number}> {
  const id = toHex(o.deviceId);
  /* nothing new: a checkpoint this phone has merged already (a computer gives every log it holds, every time) */
  const head = toHex(o.checkpoint.head).toLowerCase();
  const mirror = await loadMirror(o.deviceId);
  if ((mirror.merged ?? []).some(m => m.seq > o.checkpoint.seq || (m.seq === o.checkpoint.seq && toHex(m.head).toLowerCase() === head))) return {held: false, count: 0};
  const entry: HeldLog = {
    deviceId: id, publicKey: toHex(o.publicKey), publicKeyPq: hexOf(o.publicKeyPq), from: o.from, at: now,
    records: o.records.map(r => [toHex(r.link), toHex(r.head), r.reveal ? toHex(r.reveal) : null]),
    checkpoint: {seq: o.checkpoint.seq, head: toHex(o.checkpoint.head), signature: toHex(o.checkpoint.signature), signaturePq: hexOf(o.checkpoint.signaturePq)},
    statement: store(o.statement),
    ...(o.openings && o.openings.length ? {openings: o.openings.slice(0, 500)} : {}),
    ...(o.notes ? {notes: o.notes} : {}),
  };
  /*
   * NOT JUDGED BEFORE THIS DEVICE KNOWS ITS OWNER KEY (desktop, 2026-10-24: the A13's log came before
   * the hard key had a nametag, and was kept apart as "not made with your OnlyKey" - a false alarm).
   * Without its own signed statement this device cannot tell yours from not yours: nothing is kept,
   * and the computer gives the log again at the next sync.
   */
  if (!(await ownerKey())) {
    console.log(`[edge] log of "${o.statement.nametag}" (${id.slice(0, 8)}): not judged yet - this device has no nametag, so no owner key`);
    return {held: false, count: 0};
  }
  const v = await judge(entry);
  const list = await loadHeld();
  if (v.class === 'forged' || !v.checkOk) {
    /* the same failing log again: listed once */
    const was = list.find(h => h.deviceId === id);
    if (was && was.checkpoint.seq === o.checkpoint.seq && was.checkpoint.head.toLowerCase() === head) return {held: false, count: 0};
    await saveHeld([...list.filter(h => h.deviceId !== id), entry]);
    const warning = v.class === 'forged' ? `is not made with your OnlyKey - ${o.from} sent it; never merged` : `does not check (${v.alarm}); never merged`;
    await addNew({deviceId: id, nametag: o.statement.nametag, links: entry.records.length, from: o.from, at: now, newDevice: false, missing: [], warning});
    console.log(`[edge] log of "${o.statement.nametag}" (${id.slice(0, 8)}): kept apart - it ${warning}`);
    /* a finding about your key: the phone says so out loud too */
    NativeEdgeAlert?.post(parseInt(id.slice(0, 6), 16), netTag() + 'Edge: a log that does not check',
      `A log from "${o.statement.nametag}" (${id.slice(0, 8)}…, brought by ${o.from}) ${warning}.`, 'Edge alarm', false);
    return {held: true, count: entry.records.length};
  }
  const log = logOf(entry);
  const had = mirror.links.length;
  /* the merge point is that log's newest checkpoint: kept with both halves - the copy's hybrid anchor */
  await keepMerged(log.deviceId, log.publicKey, log.publicKeyPq, log.records, {seq: entry.checkpoint.seq, head: log.checkpoint.head, signature: log.checkpoint.signature, signaturePq: log.checkpoint.signaturePq, at: now});
  await AsyncStorage.setItem(DEVICES(), JSON.stringify(devicesLib.remember(await loadDevices(), log.statement)));
  await keepOpenings(id, log.publicKey, entry.openings ?? []);
  await keepNotes(log.deviceId, entry.notes ?? null);
  /* an earlier copy of it that failed a check is answered by this one */
  if (list.some(h => h.deviceId === id)) await saveHeld(list.filter(h => h.deviceId !== id));
  const came = Math.max(0, (await loadMirror(o.deviceId)).links.length - had);
  console.log(`[edge] log of "${v.nametag ?? o.statement.nametag}" (${id.slice(0, 8)}): merged, ${came} new link(s)${v.complete ? "" : `, ${v.missing.length} use(s) without their words`}`);
  return {held: true, count: came};
}

const recordsOf = (h: HeldLog): EdgeLinkRecord[] => h.records.map(([l, hd, r]) => ({link: fromHex(l), head: fromHex(hd), reveal: r ? fromHex(r) : null}));
const logOf = (h: HeldLog) => ({
  deviceId: fromHex(h.deviceId), publicKey: fromHex(h.publicKey), publicKeyPq: bytesOf(h.publicKeyPq), records: recordsOf(h),
  checkpoint: {seq: h.checkpoint.seq, head: fromHex(h.checkpoint.head), signature: fromHex(h.checkpoint.signature), signaturePq: bytesOf(h.checkpoint.signaturePq)},
  statement: toStatement(h.statement),
});

/* one log a computer brought: sorted by the lib with THIS key's owner key, and checked complete */
async function judge(h: HeldLog, owner?: Awaited<ReturnType<typeof ownerKey>>, known?: Device[]): Promise<HeldView> {
  if (owner === undefined) owner = await ownerKey();
  if (known === undefined) known = await loadDevices();
  const merged = ((await loadMirror(fromHex(h.deviceId))).merged ?? []).map(m => ({seq: m.seq, head: m.head}));
  const c = owner ? devicesLib.classify({log: logOf(h), ownerKey: owner.ownerKey, ownerKeyPq: owner.ownerKeyPq, known, merged}) : {class: 'forged', nametag: null, check: {ok: false, alarm: 'no-nametag'}};
  return {
    deviceId: h.deviceId, nametag: c.nametag, claimed: h.statement.nametag, class: c.class as HeldView['class'], count: h.records.length, from: h.from, at: h.at,
    checkOk: !!c.check.ok, alarm: c.check.ok ? null : c.check.alarm ?? 'bad',
    ...(await completenessOf(h)),
  };
}

/** How many devices have something new in your log you have not looked at yet (the banner). */
export async function waitingCount(): Promise<number> {
  return (await loadNew()).length;
}

/**
 * The Edge tab's banner: WHAT came into your log, from WHICH device - a warning first. Tapping it
 * opens the list; "Seen" there is your word that you looked (it never holds anything back).
 */
export async function bannerLine(): Promise<string | null> {
  const list = await loadNew();
  if (!list.length) return null;
  const w = list[0];
  return `Warning: a log from "${w.nametag}" ${(w.warning ?? '').split(';')[0]}`;
}

/*
 * FULL CARDS FOR YOUR OTHER DEVICES (Brad, 2026-10-09: "full cards, i want to see them in the
 * budget history list"): the openings that came with a merged log, checked against that log as
 * this phone now holds it (devices.checkOpenings - the grant-create subject, the weld, the key's
 * signature from the press) and filed like this phone's own budget records, under that device.
 * Words that do not check are dropped. A record kept before keeps its local fields.
 */
/* records: what to check them against - by default this phone's copy of that log; the desktop passes its copy with the links being offered (edgeSoftKey.takeShared) */
export async function keepOpenings(deviceIdHex: string, publicKey: Uint8Array, openings: unknown[], records?: EdgeLinkRecord[]): Promise<number> {
  if (!openings.length) return 0;
  const {budgetRecordKey} = require('./edgeSoftKey');
  if (!records) records = (await loadMirror(fromHex(deviceIdHex))).links;
  const good = (devicesLib as any).checkOpenings({deviceId: fromHex(deviceIdHex), publicKey, records, openings}) as any[];
  for (const o of good) {
    const key = budgetRecordKey(deviceIdHex, o.grantId);
    const was = JSON.parse((await AsyncStorage.getItem(key)) || 'null');
    await AsyncStorage.setItem(key, JSON.stringify({
      ...(was ?? {}), v: 1, reason: o.reason, scopes: o.scopes, uses: o.uses, genesis: o.genesis, signature: o.signature,
      lifetime: o.lifetime, ...(o.opened ? {opened: o.opened} : {}), from: o.from ?? '',
    }));
  }
  return good.length;
}

/* that device's notes into this phone's copy of its log - drawn, and checked against the chain's hashes, exactly as on that device */
export async function keepNotes(deviceId: Uint8Array, notes: HeldLog['notes']): Promise<void> {
  if (!notes) return;
  const {addNote} = require('./edgeStore');
  for (const [k, text] of Object.entries(notes.reasons ?? {})) if (typeof text === 'string') await addNote(deviceId, {computer: '', seq: Number(k), reason: text});
  for (const [k, text] of Object.entries(notes.messages ?? {})) if (typeof text === 'string') await addNote(deviceId, {computer: '', seq: Number(k), receiptMsg: text});
  /* that device's own seen times - its log reads the same here as there */
  if (notes.seen) await require('./edgeStore').keepSeen(deviceId, notes.seen);
}

/*
 * COMPLETE BEFORE IT ENTERS THIS PHONE'S STORE (Brad, 2026-10-09: "dont use shortcut to validate
 * syncd data, before mergering into another data store"; "a data store must contain all info
 * about the usage of the credental, including the result"). What this phone would hold after the
 * merge - its copy of that device plus the incoming links, opening words and notes - checked as a
 * whole against the chain (devices.completeness): every budget's words, every use's intent, every
 * use's result with its message. Missing or wrong anywhere: not merged, and the sheet says what.
 */
async function completenessOf(h: HeldLog): Promise<{complete: boolean; missing: string[]}> {
  try {
    const mirror = await loadMirror(fromHex(h.deviceId));
    const records = syncLib.merge(mirror.links, recordsOf(h)).links;
    const reasons: Record<string, string> = {};
    for (const [k, v] of Object.entries(mirror.reasons ?? {})) reasons[k] = (v as {text: string}).text;
    const notes = {reasons: {...reasons, ...(h.notes?.reasons ?? {})}, messages: {...(mirror.messages ?? {}), ...(h.notes?.messages ?? {})}};
    const r = (devicesLib as any).completeness({deviceId: fromHex(h.deviceId), publicKey: fromHex(h.publicKey), records, openings: h.openings ?? [], notes});
    return r.ok ? {complete: true, missing: []} : {complete: false, missing: r.missing};
  } catch (e: any) {
    return {complete: false, missing: [`could not be checked: ${String(e?.message ?? e)}`]};
  }
}

/* ------------------------------------------------ change notices (the banner refreshes on them) */

type Listener = () => void;
const listeners = new Set<Listener>();
export function onDevicesChanged(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
function notify(): void {
  for (const l of [...listeners]) {
    try { l(); } catch { /* a listener's own problem */ }
  }
}

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
import {devices as devicesLib, sync as syncLib} from 'node-onlykey-lib/edge';
import {fromHex, toHex} from 'node-onlykey-lib/bytes';
import NativeEdgeAlert from 'okedge-native/specs/NativeEdgeAlert';
import {keepMerged, loadMirror} from './edgeStore';
import type {EdgeLinkRecord} from './edgeFake';
import {edgeKey, netTag} from './net';

const DEVICES = (): string => edgeKey('devices');
const OWN = (): string => edgeKey('ownStatement');
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

/** This phone's own latest statement (its nametag), or null before one is set. */
export async function ownStatement(): Promise<StoredStatement | null> {
  return readJson<StoredStatement | null>(OWN(), null);
}

/**
 * This key's owner public keys, from its own statement: the P-256 one (X||Y) and its ML-DSA-65
 * twin (1952 bytes) - null before a nametag is set, or when the statement lacks either (both
 * are needed to check any statement).
 */
export async function ownerKey(): Promise<{ownerKey: Uint8Array; ownerKeyPq: Uint8Array} | null> {
  const s = await ownStatement();
  if (!(s?.ownerKey && s.ownerKeyPq)) return null;
  /*
   * THE OWNER KEY IS THE KEY'S, NOT STORAGE'S (Brad, 2026-10-11: "checking every field in a token
   * means nothing if we never check the signature"). Every held log is judged against this key,
   * and storage is something anything on the phone could edit: once a session it is compared with
   * a statement the soft key signs now (no press, no link). Not the key's, or the key cannot
   * answer: no owner key - nothing classifies as yours.
   */
  const id = `${s.ownerKey}.${s.ownerKeyPq}`.toLowerCase();
  if (!ownerConfirmed.has(id)) {
    try {
      const soft = await require('./edgeSoftKey').SoftKeyEdge.open();
      const fresh = soft ? store(await soft.statement(s.nametag)) : null;
      if (!fresh || `${fresh.ownerKey}.${fresh.ownerKeyPq}`.toLowerCase() !== id) {
        console.log("[edge] the stored owner key is not this key's - not used");
        return null;
      }
      ownerConfirmed.add(id);
    } catch {
      return null;
    }
  }
  return {ownerKey: fromHex(s.ownerKey), ownerKeyPq: fromHex(s.ownerKeyPq)};
}
/* the owner keys the key itself gave this session (a statement it signed) - memory only */
const ownerConfirmed = new Set<string>();

/**
 * Set this phone's nametag: the key signs it with its owner key (no press, no link) and the
 * phone keeps that statement - it travels with this phone's log to your other devices.
 */
export async function setNametag(soft: {statement(nametag: string): Promise<any>}, nametag: string): Promise<StoredStatement> {
  const st = await soft.statement(nametag);
  const s = store(st);
  /* signed by the key just now: its owner key is the key's for this session */
  if (s.ownerKey && s.ownerKeyPq) ownerConfirmed.add(`${s.ownerKey}.${s.ownerKeyPq}`.toLowerCase());
  await AsyncStorage.setItem(OWN(), JSON.stringify(s));
  notify();
  return s;
}

/** The phone's own device name (its Bluetooth name, e.g. "Bradley's A13"), or '' when it cannot be read. */
export async function deviceName(): Promise<string> {
  try {
    const NativeBtKeyboard = require('okedge-native/specs/NativeBtKeyboard').default;
    return String((await NativeBtKeyboard.localName()) ?? '').trim().slice(0, 64);
  } catch {
    return '';
  }
}

/**
 * THE DEFAULT NAMETAG (Brad, 2026-10-08: "use device name as default unless explicitly
 * changed there in nametag input"): a phone with no nametag yet signs one with its device
 * name the first time one is needed - the drawer opening, or a computer asking for its log.
 * A nametag set by hand is never replaced. -> this phone's statement, or null (no key, no name)
 */
export async function ensureNametag(soft: {statement(nametag: string): Promise<any>; deviceId?: Uint8Array} | null): Promise<StoredStatement | null> {
  const have = await ownStatement();
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
  if (have || !soft) return have;
  const name = await deviceName();
  if (!name) return null;
  try {
    return await setNametag(soft, name);
  } catch {
    return null;
  }
}

/* ------------------------------------------------ your devices */

export async function loadDevices(): Promise<Device[]> {
  return readJson<Device[]>(DEVICES(), []);
}

/** A device's nametag now, and what it was called before (its own signed statements only). */
export async function nametagOf(d: Device): Promise<{nametag: string; previously: string[]} | null> {
  const owner = await ownerKey();
  if (!owner) return d.statements.length ? {nametag: d.statements[d.statements.length - 1].nametag, previously: []} : null;
  const r = devicesLib.nametagOf(devicesLib.statementsOf(d), owner.ownerKey, owner.ownerKeyPq);
  return r ? {nametag: r.nametag, previously: r.previously} : null;
}

/** Forget a device on this phone (its merged copy stays; a later log from it asks again). */
export async function forgetDevice(deviceId: string): Promise<void> {
  const list = (await loadDevices()).filter(d => d.deviceId !== deviceId.toLowerCase());
  await AsyncStorage.setItem(DEVICES(), JSON.stringify(list));
  notify();
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

export async function loadNew(): Promise<NewItem[]> {
  return readJson<NewItem[]>(NEWS(), []);
}

/* one row per device: a later arrival before you looked adds to that row */
async function addNew(item: NewItem): Promise<void> {
  const list = await loadNew();
  const was = list.find(n => n.deviceId === item.deviceId);
  const row = was ? {...item, links: was.links + item.links, newDevice: was.newDevice || item.newDevice, warning: item.warning ?? was.warning} : item;
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
  const v = await judge(entry);
  const list = await loadHeld();
  if (v.class === 'forged' || !v.checkOk) {
    /* the same failing log again: listed once */
    const was = list.find(h => h.deviceId === id);
    if (was && was.checkpoint.seq === o.checkpoint.seq && was.checkpoint.head.toLowerCase() === head) return {held: false, count: 0};
    await saveHeld([...list.filter(h => h.deviceId !== id), entry]);
    const warning = v.class === 'forged' ? `is not made with your OnlyKey - ${o.from} sent it; never merged` : `does not check (${v.alarm}); never merged`;
    await addNew({deviceId: id, nametag: o.statement.nametag, links: entry.records.length, from: o.from, at: now, newDevice: false, missing: [], warning});
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
  await addNew({deviceId: id, nametag: v.nametag ?? o.statement.nametag, links: came, from: o.from, at: now, newDevice: v.class === 'mine-new', missing: v.complete ? [] : v.missing, warning: null});
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
  const w = list.find(n => n.warning);
  if (w) return `Warning: a log from "${w.nametag}" ${(w.warning ?? '').split(';')[0]}`;
  const names = list.map(n => `"${n.nametag}"${n.newDevice ? ' (a new device of your key)' : ''}`);
  return `New in your log: ${names.join(', ')}`;
}

/*
 * FULL CARDS FOR YOUR OTHER DEVICES (Brad, 2026-10-09: "full cards, i want to see them in the
 * budget history list"): the openings that came with a merged log, checked against that log as
 * this phone now holds it (devices.checkOpenings - the grant-create subject, the weld, the key's
 * signature from the press) and filed like this phone's own budget records, under that device.
 * Words that do not check are dropped. A record kept before keeps its local fields.
 */
async function keepOpenings(deviceIdHex: string, publicKey: Uint8Array, openings: unknown[]): Promise<number> {
  if (!openings.length) return 0;
  const {budgetRecordKey} = require('./edgeSoftKey');
  const records = (await loadMirror(fromHex(deviceIdHex))).links;
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
async function keepNotes(deviceId: Uint8Array, notes: HeldLog['notes']): Promise<void> {
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

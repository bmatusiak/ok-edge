/**
 * The Edge tab's REAL key: the soft key built with the edge firmware plugin
 * (OKEMU_PLUGINS=edge; buildInfo.hasSoftKeyPlugin('edge')), read through the
 * library's device calls (node-onlykey-lib/plugins/edge). Same EdgeSource and
 * EdgeInbox shapes as the fake key, so the screen and the store do not care
 * which one they have.
 *
 * What the key knows and what it does not (the firmware is a notary, DESIGN.md
 * section 0): it keeps the chain's head, the last links for pickup, and which
 * budgets are live - not their reasons or scopes. Those are this phone's: when
 * the person approves a budget here, its request is kept in AsyncStorage,
 * keyed by the budget id the key gave it, and its spend is counted from the
 * chain's own self-press links.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {approve as approveLib, chain, client as clientLib, codes, grants as grantsLib, request as requestLib, receipts, sync as syncLib} from 'node-onlykey-lib/edge';

/*
 * THE TESTING IDENTITY: the tab's test budget (EdgeScreen) and its test sign (agentSign) name this one identity, so
 * the budget pays for exactly that sign. A scope on a derived code must name one (lib R11a): every identity of the
 * curve shares the code, and an unnamed scope would pay for the person's own logins too.
 */
export const TESTING_IDENTITY = 'ssh://testing@okedge';
import {fromHex, toHex} from 'node-onlykey-lib/bytes';
import {getOnlyKey, type Backend} from './onlykey';
import {activeBackend} from './hooks/KeyContext';
import {shell} from './platform';
import OkEmu from './transport/OkEmu';
import {chainState, evaluate, loadMirror, takeOwnLinks, type EdgeView} from './edgeStore';
import {keptRun} from './linkStash';
/* keys whose shared records this app run has offered already (desktop) */
const takenShared = new Set<string>();
const saidShared = new Map<string, string>();

/*
 * YOUR OTHER DEVICES' LOGS FROM THE BUCKET (Brad, 2026-10-29, of key 1's old live chain, its key since wiped: "that log
 * has value" - "it can be verified without probing the key as long as the identity key matches"). The CLI files every
 * log of this identity in the bucket (lib copy.adoptAll); each other device's goes through edgeDevices.receiveLog - the
 * same judge as a log a computer brings: that device's checkpoint with both halves under the key its log carries, its
 * owner statement under YOUR owner key (one per backup: every key restored from it has it), the whole log against the
 * checkpoint. No key request; a log that does not check is kept apart with its warning. Once per log per change.
 */
const takenOther = new Set<string>();
async function takeOtherLogs(ownIdHex: string, soft: SoftKeyEdge): Promise<void> {
  const {tradeBucket} = require('./bucketStore');
  const {logblocks, copyfile} = require('node-onlykey-lib/edge');
  const open = tradeBucket();
  if (!open) return;
  /* judged only under this device's owner key (its own nametag statement): none yet - nothing marked, asked again later */
  if (!(await require('./edgeDevices').ownerKey(soft))) {
    if (saidShared.get('others') !== 'no owner key') { saidShared.set('others', 'no owner key'); console.log("[edge] other devices' logs: waiting - name this device first (its nametag gives the owner key they are judged by)"); }
    return;
  }
  const own = logblocks.devOf(ownIdHex);
  for (const store of currentNet() === 'test' ? ['edge-logs-test'] : ['edge-logs']) {
    const recs = (open.bucket.stores[store] ?? {}) as Record<string, {v: string | null; at: string; archived?: boolean}>;
    const live = Object.entries(recs).filter(([, r]) => r && !r.archived && r.v !== null);
    for (const dev of logblocks.devices(live.map(([k]) => k))) {
      if (dev === own) continue;
      const mine = live.filter(([k]) => k.startsWith(`${dev}.`));
      const mark = `${dev}:${mine.length}@${mine.reduce((m, [, r]) => (r.at > m ? r.at : m), '')}`;
      if (takenOther.has(mark)) continue;
      takenOther.add(mark);
      const j = logblocks.join(Object.fromEntries(mine.map(([k, r]) => [k, r.v as string])), JSON.parse(recs[`${dev}.meta`].v as string).deviceId);
      if (!j || !j.links.length || !j.checkpoint || !j.statement || !j.publicKey) {
        console.log(`[edge] other devices' logs: ${dev.slice(0, 8)} has no checkpoint or statement - not judged`);
        continue;
      }
      const c = copyfile.fromJSON(j, fromHex(j.deviceId));
      const {receiveLog} = require('./edgeDevices');
      const r = await receiveLog({
        deviceId: c.deviceId, publicKey: c.publicKey, publicKeyPq: c.publicKeyPq, records: c.links, checkpoint: c.checkpoint,
        statement: c.statement, from: 'the identity bucket', openings: j.openings ?? [], notes: j.notes,
      });
      console.log(`[edge] other devices' logs: "${c.statement.nametag}" (${dev.slice(0, 8)}) - ${r.held ? `${r.count} link(s) judged` : 'nothing new'}`);
    }
  }
}
let bucketSharedWhy = '';
const takingShared = new Set<string>();

/*
 * THIS APP'S OWN LOG INTO THE BUCKET (PROPOSAL-sync-and-identity.md Phase 5; Brad, 2026-10-29: "after login, it gets added
 * into the budget history, and then because the bucket changes, it will upload the bucket changes"). The read side above
 * takes this key's log from the bucket; this files what this app's copy holds back into it - the same blocks the CLI
 * writes (lib logblocks), merged into what is there (logblocks.fileInto: a fresh web app holds less than the CLI filed),
 * so the CLI, your other devices and the server's room see this app's budgets - the login's too.
 *
 * After a sync whose copy VERIFIED only: an unchecked link is never filed for others to take. The parts are the ones
 * this app hands a paired computer (edgeAgents GIVE): the links, the seals, the key's checkpoint with both halves (the
 * one the sync just checked, else the newest seal that keeps its ML-DSA half), this device's nametag statement, the
 * budgets' opening words and the notes. No key request: all of it is already here. One filing at a time; a sync that
 * lands during one files once more after it.
 */
let filing: Promise<void> | null = null;
let fileWhy = '';
let fileAgain: (() => Promise<void>) | null = null;
export function fileOwnLog(source: SoftKeyEdge, mirror: any, checkpoint: EdgeCopyKey['checkpoint']): Promise<void> {
  const run = () => fileOwnLogNow(source, mirror, checkpoint).catch((e: unknown) => console.log(`[edge] this key's log: not filed in the bucket - ${String((e as Error)?.message ?? e)}`));
  if (filing) { fileAgain = run; return filing; }
  filing = run().then(async () => {
    while (fileAgain) { const next = fileAgain; fileAgain = null; await next(); }
  }).finally(() => { filing = null; });
  return filing;
}
async function fileOwnLogNow(source: SoftKeyEdge, mirror: any, checkpoint: EdgeCopyKey['checkpoint']): Promise<void> {
  const {storeEntries, writeEntries} = require('./bucketStore');
  const {logblocks} = require('node-onlykey-lib/edge');
  const store = currentNet() === 'test' ? 'edge-logs-test' : 'edge-logs';
  const have: Record<string, string> | null = await storeEntries(store);
  /* why nothing was filed, said once each time it changes (a sync that files nothing says nothing else) */
  const why = !have ? 'no bucket is open here' : !mirror.links.length ? 'this copy holds no links' : '';
  if (why) {
    if (fileWhy !== why) { fileWhy = why; console.log(`[edge] this key's log: not filed - ${why}`); }
    return;
  }
  fileWhy = '';
  const hex = (b: Uint8Array | null | undefined) => (b ? toHex(b) : '');
  const seals = (mirror.seals ?? []) as {seq: number; head: Uint8Array; signature: Uint8Array; signaturePq?: Uint8Array}[];
  const anchor = checkpoint?.signaturePq?.length ? checkpoint : [...seals].reverse().find(s => s.signaturePq?.length) ?? null;
  const own = await require('./edgeDevices').ownStatement(toHex(source.deviceId));
  const j = {
    v: 1,
    deviceId: toHex(source.deviceId),
    links: mirror.links.map((r: EdgeLinkRecord) => ({link: hex(r.link), head: hex(r.head), ...(r.reveal ? {reveal: hex(r.reveal)} : {})})),
    lastSeen: mirror.lastSeen ? {seq: mirror.lastSeen.seq, head: hex(mirror.lastSeen.head)} : null,
    ...(mirror.publicKey ? {publicKey: hex(mirror.publicKey)} : {}),
    ...(mirror.publicKeyPq ? {publicKeyPq: hex(mirror.publicKeyPq)} : {}),
    seals: seals.map(s => ({seq: s.seq, head: hex(s.head), signature: hex(s.signature), ...(s.signaturePq?.length ? {signaturePq: hex(s.signaturePq)} : {})})),
    openings: await source.openingWords().catch(() => []),
    notes: {reasons: Object.fromEntries(Object.entries(mirror.reasons ?? {}).map(([k, v]) => [k, (v as {text: string}).text])), messages: mirror.messages ?? {}, seen: mirror.seen ?? {}},
    ...(anchor ? {checkpoint: {seq: anchor.seq, head: hex(anchor.head), signature: hex(anchor.signature), signaturePq: hex(anchor.signaturePq ?? null)}} : {}),
    ...(own ? {statement: {deviceId: own.deviceId, publicKey: own.publicKey, publicKeyPq: own.publicKeyPq, seq: own.seq, nametag: own.nametag, signature: own.signature, signaturePq: own.signaturePq}} : {}),
  };
  const {changed, forks} = logblocks.fileInto(have, j);
  for (const f of forks) console.log(`[edge] this key's log: NOT filed - ${f}`);
  const n = Object.keys(changed).length;
  if (!n) {
    const same = `already in the bucket (${mirror.links.length} link(s) held here)`;
    if (fileWhy !== same) { fileWhy = same; console.log(`[edge] this key's log: ${same}`); }
    return;
  }
  await writeEntries(store, changed);
  console.log(`[edge] this key's log: filed in the bucket (${store}) - ${n} key(s) changed, ${mirror.links.length} link(s) held here`);
  /* the bucket changed: a trade with the devices in the room now, not at the next join */
  require('./serverRoom').bucketChanged();
}

/*
 * THIS KEY'S LOG AS THE OPEN BUCKET HOLDS IT (the identity bucket's `edge-logs`, `edge-logs-test` on the testnet), in the
 * shape the desktop's shared records come in - or null when the bucket is closed or holds none. mark: the store, the
 * device's key count and newest write, so a take runs again only when a trade changed the log.
 *
 * A DEVICE ID IS ONE CHAIN, whichever net a host filed it under (box, 2026-10-29: the CLI ran hard key 2 with
 * --test-mode and filed its log in edge-logs-test; the web app had the same key on live and looked in edge-logs). The
 * nets keep the soft key's two slots apart - two chains, two device ids - so this device's log is read from this net's
 * store first, and from the other only when this one holds none of it: never another chain's links.
 */
function bucketShared(deviceIdHex: string): {mark: string; links: [string, string, string | null][]; openings: unknown[]; notes: any} | null {
  const {tradeBucket} = require('./bucketStore');
  const {logblocks} = require('node-onlykey-lib/edge');
  const open = tradeBucket();
  if (!open) { bucketSharedWhy = 'no bucket open'; return null; }
  const dev = logblocks.devOf(deviceIdHex);
  const stores = currentNet() === 'test' ? ['edge-logs-test', 'edge-logs'] : ['edge-logs', 'edge-logs-test'];
  for (const store of stores) {
    const recs = (open.bucket.stores[store] ?? {}) as Record<string, {v: string | null; at: string; archived?: boolean}>;
    const entries: Record<string, string> = {};
    let newest = '';
    for (const [k, r] of Object.entries(recs)) {
      if (!k.startsWith(`${dev}.`) || !r || r.archived || r.v === null) continue;
      entries[k] = r.v;
      if (r.at > newest) newest = r.at;
    }
    const j = logblocks.join(entries, deviceIdHex);
    if (!j || !j.links.length) continue;
    return {
      mark: `${store}:${Object.keys(entries).length}@${newest}`,
      links: j.links.map((l: {link: string; head: string; reveal?: string}) => [l.link, l.head, l.reveal ?? null] as [string, string, string | null]),
      openings: j.openings ?? [],
      notes: j.notes,
    };
  }
  bucketSharedWhy = `the bucket holds no log for ${deviceIdHex.slice(0, 8)} (${stores.map(s => `${s} ${Object.keys(open.bucket.stores[s] ?? {}).length} keys`).join(', ')})`;
  return null;
}
import type {EdgeBudget, EdgeCopyCheck, EdgeCopyKey, EdgeEnded, EdgeInbox, EdgeKeyState, EdgeLinkRecord, EdgeRequest, EdgeSource} from './edge/types';
import {currentNet, edgeKey} from './net';

const {DECISION, OP} = codes;

/* how many of these uses have a receipt in the copy (a receipt link names the use it answers) */
function receipted(mirror: {links: {link: Uint8Array}[]}, uses: number[]): number {
  const answered = new Set(mirror.links.map(r => chain.decodeLink(r.link)).filter(f => f.op === OP.RECEIPT).map(f => (f as {refSeq?: number}).refSeq));
  return uses.filter(q => answered.has(q)).length;
}
const PICKUP_MAX = 8;
const REGISTRY = (): string => edgeKey('budgets.');
/* one budget's record on this phone - its own budgets, and (since 2026-10-09) your other devices' checked openings */
export const budgetRecordKey = (deviceIdHex: string, grantId: number): string => REGISTRY() + deviceIdHex.toLowerCase() + '.' + grantId;

/*
 * What this phone keeps of a budget it approved: the request, G, and the
 * checkpoint signature its press answered with - the opening R27 checks
 * (grants.verifyBudgetOpening). A budget kept without a signature (approved
 * before this was stored) cannot be checked, so a copy holding it does not
 * verify.
 */
type Kept = {
  /* 1 since the clean start (Brad, 2026-10-07; the old chain's records went with it, edgeV1.ts) */
  v?: number;
  reason: string; scopes: EdgeRequest['scopes']; uses: number; genesis: string; from: string; signature?: string;
  /* R15b: the lifetime it was opened with (minutes, 0 = the key's 12 h) and when (the phone's clock) - for Continue */
  lifetime?: number; opened?: number;
  /* Continue asked for once already: the card goes */
  continued?: boolean;
  /* budget history: when this phone first saw it no longer live (its clock) - the chain carries no times */
  endedAt?: number;
  /* 4.7a: an ended agent budget's card dismissed (nothing on the key changes) */
  dismissed?: boolean;
  /* opened for an EDGE_REQUEST from a paired computer: its pairing id - a continue must come from the same computer (no agent key since 2026-10-08) */
  computer?: string;
};
const DEFAULT_LIFETIME_MINUTES = 12 * 60;

type SameHead = {key: string; raw: any; checkpoint?: any};
/* per key: the answers the key gave for its current head, and its Edge public keys (P-256, ML-DSA-65) - this session's memory only */
const sameHeads = new Map<string, SameHead>();
const publicKeys = new Map<string, Uint8Array>();
const publicKeysPq = new Map<string, Uint8Array>();
/*
 * THE BUDGET OPENINGS, IN MEMORY FOR THE SESSION (A13, 2026-10-07: copyKey without a
 * checkpoint still 125-699 ms - the storage key list and every budget record read,
 * and each reason hashed, on every sync). They are records THIS phone writes when it
 * approves a budget, so storage is read once a session and our own write adds to the
 * memory; nothing else changes them. A record edited in storage meanwhile is read at
 * the next start, and an opening that does not match the chain fails the check closed.
 */
const openingsKept = new Map<string, Map<number, unknown>>();
function openingOf(kept: Kept) {
  return {
    scopes: kept.scopes, reasonHash: receipts.messageHash(kept.reason), genesis: fromHex(kept.genesis),
    uses: kept.uses, lifetime: kept.lifetime ?? 0, signature: fromHex(kept.signature ?? ''),
  };
}

/*
 * A grant-end link's decision byte, in words (node-onlykey-lib edge codes.END; Brad, 2026-10-10:
 * "budgets should auto complete once fufilled"): completed - every use made and receipted, the
 * key ended it itself; revoked - ended early; settled - ended early by a settle, incomplete.
 */
function endName(decision: number | undefined): string {
  return decision === codes.END.COMPLETED ? 'completed' : decision === codes.END.SETTLED ? 'settled (incomplete)' : decision === codes.END.REVOKED ? 'revoked' : 'ended';
}

export class SoftKeyEdge implements EdgeSource, EdgeInbox {
  readonly deviceId: Uint8Array;
  private edge: any;
  private requests: EdgeRequest[] = [];
  private nextRequest = 1;
  private pressWanted: (() => void) | null = null;

  /* which key this is: the soft key (embedded) or a hard key (usb) - a caller that keeps one reopens when the active key changes */
  backend: Backend = 'embedded';

  private constructor(edge: any, deviceId: Uint8Array) {
    this.edge = edge;
    this.deviceId = deviceId;
  }

  /** null when the soft key does not answer Edge (no plugin, or locked). */
  /* this session's memory, per key (device id hex) - never stored */
  static forgetSession() {
    sameHeads.clear();
    publicKeys.clear();
    publicKeysPq.clear();
  }

  /*
   * THE KEY: the one the app is using - its soft key, or a hard key - on the phone and the desktop alike
   * (Brad, 2026-10-24: "i need this to be a 1 to 1 in how it works"; KeyContext.activeBackend). Both run
   * the same Edge firmware plugin, so the Edge code - the tab, the host, the background sync, the
   * nametag - drives either one.
   */
  /* why the last open() gave null: 'no-pin' (locked), 'none' (no answer in time), anything else (no Edge) - for a screen that must SAY which */
  static lastProbe: string | null = null;

  static async open(): Promise<SoftKeyEdge | null> {
    const backend = activeBackend();
    const app = await getOnlyKey(backend);
    /* 4 s: right after start the background sync's chain reads go first (lib client.js deviceIdentity, 2026-10-04) */
    SoftKeyEdge.lastProbe = await app.edge.probe({timeoutMs: 4000});
    if (SoftKeyEdge.lastProbe !== 'edge') return null;
    const {deviceId} = await app.edge.publicKey();
    const soft = new SoftKeyEdge(app.edge, deviceId);
    soft.backend = backend;
    /* "this device" for the statements (edgeDevices: one per device id) is the key the app opened just now */
    require('./edgeDevices').setCurrentDevice(toHex(deviceId), backend);
    /*
     * THE DEFAULT NAMETAG, MADE EARLY (Brad, 2026-10-08: "i still had to click change name tag"):
     * the first time the app reaches the key after login (the background sync does, within
     * seconds), a phone with no nametag signs its device name - so it is there before anyone
     * opens Edge Management. Once per phone; a nametag set by hand is never replaced.
     */
    void require('./edgeDevices').ensureNametag(soft).catch(() => undefined);
    await soft.takeShared().catch((e: any) => console.log(`[edge] shared records: not read - ${String(e?.message ?? e)}`));
    return soft;
  }

  /*
   * ON THE DESKTOP, THE KEY'S OLDER LINKS COME FROM THIS COMPUTER'S SHARED RECORDS (~/.onlykey-js):
   * a hard key holds only its newest links, and what the CLI picked up before is there. Offered
   * the way a computer offers links to a phone, under the same rules (edgeStore.takeOwnLinks).
   * Once per key per app run: later links the tab reads from the key itself.
   *
   * EVERYWHERE ELSE, FROM THE IDENTITY BUCKET (PROPOSAL-sync-and-identity.md Phase 2; Brad, 2026-10-29: "plugin my live
   * key, and see budget history over in the webapp from the cli"): the CLI files each device's log in the bucket's
   * `edge-logs` store as blocks (lib edge/src/logblocks.js), a trade brings them here, and this key's own log is taken
   * the same way - nothing is asked of the key for them that the take does not ask anyway. Again only when the bucket's
   * log for this key changed (a later trade brought more): the newest write and the key count say so.
   */
  async takeShared(): Promise<void> {
    /* one take at a time for a key: a take that started another (through any path back here) waits on nothing */
    const id = toHex(this.deviceId);
    if (takingShared.has(id)) return;
    takingShared.add(id);
    try {
      await this.takeSharedNow(id);
    } finally {
      takingShared.delete(id);
    }
  }

  private async takeSharedNow(id: string): Promise<void> {
    /*
     * THE BUCKET ON EVERY PLATFORM (2026-10-30, the desktop on key 3: "0 of 9 used", "validated unused", no device names).
     * The desktop used to ask the main process for the CLI's old copy file instead (okedge:sharedLinks) - it had no bucket
     * in memory - and skipped the other devices' logs. Since R1 it holds the bucket like the others, and the CLI files its
     * log there (with each budget's opening words: which device, why), so it reads it here, the same way.
     */
    await takeOtherLogs(id, this).catch((e: any) => console.log(`[edge] other devices' logs: not read - ${String(e?.message ?? e)}`));
    const fromBucket = bucketShared(id);
    /* why nothing was taken, said once each time it changes (every refresh asks; a quiet one says nothing) */
    const why = !fromBucket ? bucketSharedWhy : takenShared.has(`${id}:${fromBucket.mark}`) ? `already taken (${fromBucket.mark})` : null;
    if (why && saidShared.get(id) !== why) { saidShared.set(id, why); console.log(`[edge] shared records: ${why}`); }
    if (why || !fromBucket) return;
    takenShared.add(`${id}:${fromBucket.mark}`);
    const shared: {links: [string, string, string | null][]; openings: unknown[]; notes: any} = fromBucket;
    if (!shared || !shared.links.length) return;
    const offered = shared.links.map(([l, h, r]) => ({link: fromHex(l), head: fromHex(h), reveal: r ? fromHex(r) : null}));
    /*
     * ITS BUDGETS' OPENING WORDS AND ITS NOTES FIRST: a use is checked against its budget's opening,
     * and these budgets were opened through this computer, not this app. Filed by the phone's own
     * functions for a log a computer brings (edgeDevices) - checked against the copy with these links.
     */
    const {keepOpenings, keepNotes} = require('./edgeDevices');
    const records = syncLib.merge((await loadMirror(this.deviceId)).links, offered).links;
    const opened = await keepOpenings(toHex(this.deviceId), (await this.copyKey({checkpoint: false})).publicKey, shared.openings ?? [], records);
    await keepNotes(this.deviceId, shared.notes);
    console.log(`[edge] shared records: ${opened} budget opening(s) and the notes filed`);
    const t = await takeOwnLinks(this, offered);
    console.log(`[edge] shared records: ${t.ok ? `${t.count} link(s) taken` : `nothing taken - ${t.detail}`}`);
  }

  /*
   * THE KEY'S ANSWERS FOR ONE HEAD (Brad, 2026-10-06): its checkpoint (a signature
   * the key makes, ~0.6 s) is reused only while the head the
   * key last gave is unchanged. Every sync still reads the head from the key
   * first; a new head drops them. Memory only - a restart clears them.
   */
  /* shared by every SoftKeyEdge for this key (the tab, the background sync, the agent sheet each open one) */
  private get sameHead(): SameHead | null {
    return sameHeads.get(toHex(this.deviceId)) ?? null;
  }
  private noteHead(h: any) {
    const key = `${h.seq}:${h.head ? toHex(h.head) : ''}:${h.owed ?? ''}`;
    const id = toHex(this.deviceId);
    const was = sameHeads.get(id);
    if (!was || was.key !== key) sameHeads.set(id, {key, raw: h});
    else was.raw = h;
  }

  async head() {
    const h = await this.edge.head();
    this.noteHead(h);
    /*
     * no link yet: seq -1 against the genesis head verifies as "nothing recorded".
     * No oldest with a seq: the ring is EMPTY (right after a restore the key holds
     * none of its links), so it starts past the head - asking for #0 was refused
     * (EDGE:09) and the tab showed only "the key no longer holds that link".
     */
    const seq = h.seq === null ? -1 : h.seq;
    return {seq, head: h.head, ringFrom: h.oldest === null ? seq + 1 : h.oldest};
  }

  async read(fromSeq: number, count: number): Promise<EdgeLinkRecord[]> {
    const h = await this.edge.head();
    if (h.seq === null || h.oldest === null) return []; /* nothing recorded, or nothing held (after a restore) */
    const from = Math.max(fromSeq, h.oldest); /* older links are gone from the key: a gap, not an error */
    const last = Math.min(h.seq, fromSeq + count - 1);
    const out: EdgeLinkRecord[] = [];
    for (let s = from; s <= last; s += PICKUP_MAX) {
      const got = await this.edge.pickup(s, Math.min(PICKUP_MAX, last - s + 1));
      for (const l of got) out.push({link: l.link, head: l.head, reveal: l.reveal});
    }
    /*
     * THE LINKS THE KEY NO LONGER HOLDS, from the ones this app kept as the key wrote them (linkStash) - only when the
     * kept run welds onto the oldest link the key still has: a stash from another chain is never this one's.
     */
    if (fromSeq < h.oldest) {
      const kept = await keptRun(fromSeq, h.oldest - 1);
      if (kept.length) {
        const [tie] = from <= last ? [out[0]] : await this.edge.pickup(h.oldest, 1);
        let ok = kept.every((k, i) => i === 0 || toHex(chain.weld(kept[i - 1].record.head, k.record.link)) === toHex(k.record.head));
        ok = ok && !!tie && toHex(chain.weld(kept[kept.length - 1].record.head, tie.link)) === toHex(tie.head);
        if (ok) {
          console.log(`[edge] read: #${kept[0].seq}-#${kept[kept.length - 1].seq} from the links kept as the key wrote them`);
          return [...kept.map(k => k.record), ...out];
        }
        console.log(`[edge] read: the kept links #${kept[0].seq}-#${kept[kept.length - 1].seq} do not weld onto the key's #${h.oldest} - not used`);
      }
    }
    return out;
  }

  /* live budgets: the ids from the key, the details this phone kept, the spend from the chain */
  /*
   * One budget, as the cards show it: what this phone kept when it opened it
   * (reason, scopes, agent, when) and what the chain says it spent. Live and past
   * budgets alike (Brad, 2026-10-04: "what about budget history?").
   */
  /* the live budget ids at the last budgets() - to stamp when one goes */
  private lastLive: number[] = [];

  /*
   * ONE READ PER ACTION (Brad, 2026-10-06: every press re-read the key and the
   * copy five times over). Between beginRun() and endRun() - after an action's
   * own work, while the tab refreshes - the key's head, this phone's copy and
   * the storage keys are read once and shared. Outside a run, each call reads
   * fresh, as before. Memory only, for the length of one refresh.
   */
  private snap: {head?: any; mirror?: Awaited<ReturnType<typeof loadMirror>>; keys?: readonly string[]; checkpoint?: any} | null = null;
  beginRun() {
    this.snap = {};
  }
  endRun() {
    this.snap = null;
  }
  private async keyHead(): Promise<any> {
    /*
     * The snapshot is held in a local across the await: runs overlap (a sync
     * queued behind a computer's hold, then another), and one run's endRun()
     * cleared it while this one waited for the key - "Cannot read property
     * 'head' of null" on the tab (Pixel, 2026-10-06). A cleared snapshot
     * only means this read is a fresh one.
     */
    const snap = this.snap;
    if (!snap) { const h = await this.edge.head(); this.noteHead(h); return h; }
    if (!snap.head) { snap.head = await this.edge.head(); this.noteHead(snap.head); }
    return snap.head;
  }
  private async mirrorNow() {
    if (!this.snap) return loadMirror(this.deviceId);
    return (this.snap.mirror ??= await loadMirror(this.deviceId));
  }
  private async storageKeys(): Promise<readonly string[]> {
    if (!this.snap) return AsyncStorage.getAllKeys();
    return (this.snap.keys ??= await AsyncStorage.getAllKeys());
  }

  /* other: another device's budget - its opening's from names who asked (no pairing id travels) */
  private budgetFrom(id: number, kept: Kept | null, mirror: Awaited<ReturnType<typeof loadMirror>>, other = false): EdgeBudget {
    const spentRows = mirror.links
      .map(r => ({f: chain.decodeLink(r.link), scope: (r.link as Uint8Array)[46] || 0}))
      .filter(x => x.f.grantId === id && x.f.decision === DECISION.SELF_PRESS);
    const spent = spentRows.map(x => x.f);
    /* R3 (2026-10-03): byte 46 names the scope that paid - each identity its own count, from the chain */
    const exact = spentRows.length > 0 && spentRows.every(x => x.scope > 0);
    /*
     * A spend names its budget and its step (grantId, grantStep), not its scope:
     * the link's subject is a hash of the bytes signed. So the total comes from
     * the steps, and a scope's count is exact only when no other scope of the
     * budget shares its op and slot - two agent identities on slot 221 share one
     * count, and the card draws them as one line (spec session, 2026-10-03: the
     * gpg use showed under the ssh scope too).
     */
    const scopes = (kept?.scopes ?? []).map((sc, j) => ({
      ...sc,
      used: exact
        ? spentRows.filter(x => x.scope === j + 1).length
        : spent.filter(f => f.op === sc.op && f.slot === sc.slot).length,
    }));
    const stepsSpent = spent.reduce((m, f) => Math.max(m, f.grantStep), 0);
    return {
      grantId: id,
      reason: kept ? kept.reason : `Budget ${id} (opened elsewhere)`,
      computerId: kept?.computer,
      uses: kept ? kept.uses : spent.length,
      used: Math.max(stepsSpent, spent.length),
      scopes,
      /* every spend named its scope (R3): the per-scope counts are exact; else an older chain - shared slots stay one line */
      exact: exact || spent.length === 0,
      genesis: new Uint8Array(0),
      endsAt: kept?.opened ? kept.opened + (kept.lifetime || DEFAULT_LIFETIME_MINUTES) * 60000 : undefined,
      /* the audit log (budget history): when it opened, its lifetime, and how many uses got their receipt */
      ...(kept?.opened ? {openedAt: kept.opened} : {}),
      lifetime: kept?.lifetime || DEFAULT_LIFETIME_MINUTES,
      receiptsFiled: receipted(mirror, spent.map(f => f.seq)),
      ...(kept?.endedAt ? {endedAt: kept.endedAt} : {}),
      ...(kept?.computer || (other && kept?.from) ? {agent: kept!.from} : {}),
    };
  }

  /* useLastHead: the head this sync just read from the key (edgeStore.syncNow's alarms) - not a second read */
  async budgets(useLastHead = false): Promise<EdgeBudget[]> {
    const h = useLastHead && this.sameHead ? this.sameHead.raw : await this.keyHead();
    const mirror = await this.mirrorNow();
    const out: EdgeBudget[] = [];
    /* a budget that was live at the last look and is not now: stamp when it was seen gone (the log's 'lasted') */
    for (const gone of this.lastLive.filter(id => !(h.live as number[]).includes(id))) {
      const key = REGISTRY() + toHex(this.deviceId) + '.' + gone;
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        const kept = JSON.parse(raw) as Kept;
        if (!kept.endedAt) await AsyncStorage.setItem(key, JSON.stringify({...kept, endedAt: Date.now()}));
      }
    }
    this.lastLive = [...(h.live as number[])];
    for (const id of h.live as number[]) {
      const raw = await AsyncStorage.getItem(REGISTRY() + toHex(this.deviceId) + '.' + id);
      out.push(this.budgetFrom(id, raw ? JSON.parse(raw) : null, mirror));
    }
    /* an open budget holds the idle check off until it ends (src/idleTimer.ts) - with the latest end the key will let it run to */
    require('./idleTimer').setBudgetsOpen(out.map(b => b.endsAt ?? Date.now() + DEFAULT_LIFETIME_MINUTES * 60000));
    return out;
  }

  /*
   * BUDGET HISTORY: every budget this phone opened that is not live now, newest
   * first, with how it ended - from the chain where it can say (a grant-end link:
   * revoked or ended; every use spent), else from the clock (past its lifetime),
   * else the key lost it with a lock or restart (budgets live in RAM).
   */
  async pastBudgets(): Promise<EdgeBudget[]> {
    const h = await this.keyHead();
    return this.historyOf(toHex(this.deviceId), await this.mirrorNow(), new Set(h.live as number[]));
  }

  /*
   * YOUR OTHER DEVICES' BUDGETS (Brad, 2026-10-09: "full cards, i want to see them in the budget
   * history list"): the same cards, built the same way from that device's merged log and the
   * opening words it sent - kept only after they checked against the log (edgeDevices
   * receiveLog). Its live budgets are not known here: one not ended in the log shows as it
   * stood at the last merge. device: its nametag, for the card's corner.
   */
  async deviceBudgets(deviceIdHex: string, device: string): Promise<EdgeBudget[]> {
    const out = await this.historyOf(deviceIdHex, await loadMirror(fromHex(deviceIdHex)), new Set(), true);
    return out.map(b => ({...b, device, deviceId: deviceIdHex.toLowerCase()}));
  }

  /**
   * ANOTHER DEVICE'S CHAIN VIEW (Brad, 2026-10-09: "all the data i see on the a13 should be just
   * like on the pixel"): its merged log, checked under its own key against the last checkpoint
   * merged, with its openings and notes - the same rows (receipts paired, intents checked) its
   * own phone draws. That checkpoint is the copy's newest, its one hybrid anchor (2026-10-10):
   * it must verify with both halves, under both of that device's keys kept with the copy.
   */
  async deviceView(deviceIdHex: string): Promise<EdgeView> {
    const mirror = await loadMirror(fromHex(deviceIdHex));
    /*
     * THE STORED KEY MUST BE THAT DEVICE'S (Brad, 2026-10-11): its public key is read back from
     * storage, so it is checked against the device id it is filed under (chain.deviceIdOf) - a
     * chain signed by some other key, filed under this id, is red, not verified.
     */
    let own = false;
    try { own = !!mirror.publicKey && toHex(chain.deviceIdOf(mirror.publicKey)) === deviceIdHex.toLowerCase(); } catch { own = false; }
    if (mirror.publicKey && !own) return {...evaluate(mirror, null), verdict: {kind: 'tampered', seq: -1, reason: "the stored public key is not this device's"}};
    const last = (mirror.merged ?? [])[(mirror.merged ?? []).length - 1];
    if (!last || !mirror.publicKey) return evaluate(mirror, null);
    const prefix = REGISTRY() + deviceIdHex.toLowerCase() + '.';
    const keys = (await this.storageKeys()).filter(key => key.startsWith(prefix));
    const openings: Record<number, unknown> = {};
    for (const [key, raw] of Object.entries(await AsyncStorage.getMany([...keys]))) {
      const rec: Kept | null = JSON.parse(raw || 'null');
      if (rec && rec.signature) openings[Number(key.slice(prefix.length))] = openingOf(rec);
    }
    return evaluate(mirror, {seq: last.seq, head: last.head, ringFrom: last.seq + 1}, [], {publicKey: mirror.publicKey, publicKeyPq: mirror.publicKeyPq ?? null, openings, checkpoint: {seq: last.seq, head: last.head, signature: last.signature, signaturePq: last.signaturePq ?? null}});
  }

  /* every budget with a record on this phone for that device and not live now, newest first */
  private async historyOf(deviceIdHex: string, mirror: Awaited<ReturnType<typeof loadMirror>>, live: Set<number>, other = false): Promise<EdgeBudget[]> {
    const prefix = REGISTRY() + deviceIdHex.toLowerCase() + '.';
    const keys = (await this.storageKeys()).filter(k => k.startsWith(prefix));
    /* how each budget ended, from its grant-end link's decision byte (the key writes completed / revoked / settled) */
    const ends = new Map(mirror.links.map(r => chain.decodeLink(r.link)).filter(f => f.op === OP.GRANT_END).map(f => [f.grantId, f.decision] as const));
    const out: EdgeBudget[] = [];
    for (const k of keys) {
      const id = Number(k.slice(prefix.length));
      if (!Number.isInteger(id) || live.has(id)) continue;
      const raw = await AsyncStorage.getItem(k);
      const b = this.budgetFrom(id, raw ? JSON.parse(raw) : null, mirror, other);
      b.endedHow = ends.has(id) ? endName(ends.get(id)) : b.endsAt && Date.now() > b.endsAt ? 'expired' : 'lost when the key locked or restarted';
      /* like a block: the links it spans - its opening to the last link that names it (a use, its end) or answers one of its uses (a receipt) */
      const decoded = mirror.links.map(r => chain.decodeLink(r.link));
      const useSeqs = new Set(decoded.filter(f => f.grantId === id && f.op !== OP.RECEIPT).map(f => f.seq));
      const mine = decoded.filter(f => (f.op !== OP.RECEIPT && f.grantId === id) || (f.op === OP.RECEIPT && useSeqs.has((f as {refSeq?: number}).refSeq as number)));
      if (mine.length) {
        b.firstSeq = mine[0].seq;
        b.lastSeq = mine[mine.length - 1].seq;
      }
      /*
       * WHEN IT ENDED (spec 2026-10-04: "lasted 10 min of 5 min" - count to its end):
       * its grant-end link, when this phone saw it; else the stamp from when it was
       * seen gone - but never past its lifetime, which no budget outlives (the phone
       * may have looked long after it expired).
       */
      const endLink = decoded.find(f => f.op === OP.GRANT_END && f.grantId === id);
      const endSeen = endLink ? mirror.seen[endLink.seq] : undefined;
      if (endSeen) b.endedAt = endSeen;
      if (b.endsAt && (!b.endedAt || b.endedAt > b.endsAt)) b.endedAt = b.endsAt;
      out.push(b);
    }
    return out.sort((a, b2) => b2.grantId - a.grantId);
  }

  /**
   * THIS PHONE'S BUDGET OPENINGS, as they travel with its log (GIVE): the words and the press's
   * checkpoint signature - what lets your other devices show full cards after checking them
   * against this log (devices.checkOpenings). Only openings kept with their signature.
   */
  async openingWords(): Promise<Record<string, unknown>[]> {
    const prefix = REGISTRY() + toHex(this.deviceId) + '.';
    const keys = (await this.storageKeys()).filter(key => key.startsWith(prefix));
    const out: Record<string, unknown>[] = [];
    for (const [key, raw] of Object.entries(await AsyncStorage.getMany([...keys]))) {
      const kept: Kept | null = JSON.parse(raw || 'null');
      if (!kept || !kept.signature) continue;
      out.push({
        grantId: Number(key.slice(prefix.length)), reason: kept.reason, scopes: kept.scopes, uses: kept.uses, lifetime: kept.lifetime ?? 0,
        genesis: kept.genesis, signature: kept.signature, ...(kept.opened ? {opened: kept.opened} : {}), ...(kept.from ? {from: kept.from} : {}),
      });
    }
    return out;
  }

  async messages() {
    return {}; /* none from the key: a receipt message comes as a note from the computer that sent the receipt (edgeStore.addNote), or with another device's log; the Worker (E5) is later */
  }

  /* rule 8 (Brad, 2026-10-06): the person's Revoke and Hold go to the front of the key's lane (urgent) - never behind an agent */
  async revoke(grantId: number) {
    await this.edge.revoke(grantId, {urgent: true});
  }

  /* this key's identity id - the owner key's (lib edge identityId: one read per connection), the same on every device restored from one backup */
  async identityId(): Promise<string> {
    return this.edge.identityId();
  }

  async state(): Promise<EdgeKeyState> {
    const h = await this.keyHead();
    return {owed: h.owed, held: h.held, refusedTx: h.refusedTx ?? 0};
  }

  async hold(grantId: number) {
    await this.edge.hold(grantId, {urgent: true});
  }

  /* R15a + R27: like Approve, only from a copy that verifies, then the press */
  async resume(grantId: number, onPress?: () => void) {
    await this.edge.resume(grantId, {verifiedHead: await this.verifiedHead(), onPress: this.pressing(onPress)});
    this.pressWanted = null;
  }

  async settle(onPress?: () => void) {
    await this.edge.settle({onPress: this.pressing(onPress)});
    this.pressWanted = null;
  }

  async acceptLoss(from: number, to: number, onPress?: () => void) {
    await this.edge.loss({from, to, onPress: this.pressing(onPress)});
    this.pressWanted = null;
  }

  /**
   * The owner statement (Brad, 2026-10-08): the key signs its own fingerprint and this
   * phone's NAMETAG with its owner key - no press, no link. Another device of yours checks
   * it with its own owner key (lib devices.classify); so does this phone, against the
   * statements that arrive with offered logs.
   */
  async statement(nametag: string) {
    return this.edge.statement(nametag);
  }

  /*
   * TESTING MODE: what an agent does through ssh/gpg - an agent-derived P-256
   * sign (OKSIGN 222), pressed on the soft key's own button the way the e2e
   * does it, and no receipt after it. It leaves a debt on the key (R16), so the
   * tab's owed banner and Settle can be seen without a CLI or an MCP server.
   */
  async agentSign(text: string) {
    const app = await getOnlyKey('embedded');
    const message = receipts.messageHash(`okrn testing ${text} ${Date.now()}`);
    const identity = grantsLib.identityLabel(TESTING_IDENTITY);
    const timer = setTimeout(() => { void OkEmu.pressQueue('1'); }, 1500);
    try {
      await app.okcrypto.agent.sign(identity, message, {keyType: 2, version: 2});
    } finally {
      clearTimeout(timer);
    }
  }

  /*
   * TESTING MODE: a sign a budget PAYS - what an agent's use is (the MCP plan's items run as these): TX start over the
   * key's head, the agent-derived P-256 sign (OKSIGN 222) for the testing identity with no press, then its receipt;
   * the last use's receipt ends the budget. Through the lib's budget client (edge client.js, what onlykey-js edge exec
   * runs) over this app's own key - the web app's WebAuthn tunnel included - so the use is checked the same way: the
   * link is this use's, paid by this budget's self-press. The budget is the newest live one with a sign scope on 222
   * for the testing identity (the tab's "Agent: request a budget"). No channel: this app is the phone, no note to send.
   */
  async budgetSign(text: string): Promise<{grantId: number; seq: number; paid: boolean}> {
    const app = await getOnlyKey(this.backend);
    const h = await this.edge.head();
    const dev = toHex(this.deviceId);
    let found: {grantId: number; kept: Kept} | null = null;
    for (const id of [...(h.live ?? [])].sort((a: number, b: number) => b - a)) {
      const raw = await AsyncStorage.getItem(REGISTRY() + dev + '.' + id);
      const kept = raw ? (JSON.parse(raw) as Kept) : null;
      if (kept && kept.scopes.some(sc => sc.slot === 222 && sc.identity === TESTING_IDENTITY)) { found = {grantId: id, kept}; break; }
    }
    if (!found) throw new Error('edge: no live budget for the testing identity on this key - request one first');
    const {grantId, kept} = found;
    /* the client's record of the budget, from the opening this app kept when it approved it (keepOpening) */
    const record = {grantId, uses: kept.uses, genesis: kept.genesis, head: toHex(h.head), reason: kept.reason, scopes: kept.scopes, lifetime: kept.lifetime ?? 0, owed: [], deviceId: dev};
    const store = {get: async () => JSON.stringify(record), set: async () => undefined};
    const budget = await clientLib.createEdgeClient({edge: this.edge, channel: null, store}).resume(grantId);
    const identity = grantsLib.identityLabel(TESTING_IDENTITY);
    const message = receipts.messageHash(`okedge testing ${text} ${Date.now()}`);
    /* the bytes the key signs - the message, then the identity's label (okcrypto agent.sign) - are what the TX start names */
    const payload = new Uint8Array(message.length + identity.length);
    payload.set(message);
    payload.set(identity, message.length);
    const {link} = await budget.use(payload, () => app.okcrypto.agent.sign(identity, message, {keyType: 2, version: 2}), {reason: `testing: ${text}`});
    await budget.receipt(link, {code: 'OK', message: `testing: ${text} - signed`});
    return {grantId, seq: link.seq, paid: link.paid};
  }

  /*
   * Continue (spec APP.md; Brad, 2026-10-02: "a continue budget when
   * I get back"): a budget this phone approved that the key no longer lists,
   * with no grant-end link (a revoke ends it for good), and with uses and time
   * left. Uses left come from the chain's own self-press links; time left is
   * the original lifetime minus what the phone's clock says has passed -
   * stepping away never extends the day.
   */
  async ended(): Promise<EdgeEnded[]> {
    const h = await this.keyHead();
    const mirror = await this.mirrorNow();
    const fields = mirror.links.map(r => chain.decodeLink(r.link));
    const prefix = REGISTRY() + toHex(this.deviceId) + '.';
    const out: EdgeEnded[] = [];
    for (const k of await this.storageKeys()) {
      if (!k.startsWith(prefix)) continue;
      const grantId = Number(k.slice(prefix.length));
      const kept: Kept | null = JSON.parse((await AsyncStorage.getItem(k)) || 'null');
      if (!kept || kept.continued || kept.dismissed || !kept.opened || (h.live as number[]).includes(grantId)) continue;
      if (fields.some(f => f.op === codes.OP.GRANT_END && f.grantId === grantId)) continue;
      const spent = fields.filter(f => f.grantId === grantId && f.decision === DECISION.SELF_PRESS);
      const scopes = kept.scopes
        .map(sc => ({...sc, cap: sc.cap - spent.filter(f => f.op === sc.op && f.slot === sc.slot).length}))
        .filter(sc => sc.cap > 0);
      const lifetime = kept.lifetime || DEFAULT_LIFETIME_MINUTES;
      const minutesLeft = Math.floor(lifetime - (Date.now() - kept.opened) / 60000);
      if (!scopes.length || minutesLeft < 1) continue;
      out.push({grantId, reason: kept.reason, scopes, usesLeft: scopes.reduce((n, sc) => n + sc.cap, 0), minutesLeft, ...(kept.computer ? {agent: kept.from} : {})});
    }
    return out;
  }

  async dismissEnded(grantId: number) {
    const k = REGISTRY() + toHex(this.deviceId) + '.' + grantId;
    const kept: Kept | null = JSON.parse((await AsyncStorage.getItem(k)) || 'null');
    if (kept) await AsyncStorage.setItem(k, JSON.stringify({...kept, dismissed: true}));
  }

  /**
   * 4.7a: the LIVE budgets that already cover what a request names - same op,
   * slot and identity - with uses left and when each ends ("this agent already
   * has N uses left on <identity> until <time>"). sameComputer: opened for the
   * paired computer that asks.
   */
  async coverOf(msg: any, computer: string | null = null) {
    const live = await this.budgets();
    const out: {identity?: string; slot: number; usesLeft: number; endsAt?: number; grantId: number; sameComputer: boolean}[] = [];
    for (const b of live) {
      const kept: Kept | null = JSON.parse((await AsyncStorage.getItem(REGISTRY() + toHex(this.deviceId) + '.' + b.grantId)) || 'null');
      for (const want of msg.scopes as any[]) {
        const op = want.op === 'sign' ? codes.OP.SIGN : want.op === 'decrypt' ? codes.OP.DECRYPT : want.op;
        const sc: any = b.scopes.find((x: any) => x.op === op && x.slot === want.slot && (x.identity || '') === (want.identity || ''));
        if (!sc) continue;
        out.push({
          ...(want.identity ? {identity: want.identity} : {}), slot: want.slot, usesLeft: Math.max(0, sc.cap - sc.used),
          endsAt: b.endsAt, grantId: b.grantId, sameComputer: !!kept?.computer && kept.computer === computer,
        });
      }
    }
    return out;
  }

  async continueBudget(grantId: number) {
    const e = (await this.ended()).find(x => x.grantId === grantId);
    if (!e) throw new Error(`edge: budget ${grantId} cannot be continued`);
    this.requests.push({
      id: this.nextRequest++, from: 'this device (Continue)', reason: `continues #${grantId}: ${e.reason}`,
      scopes: e.scopes, ttlMinutes: e.minutesLeft,
    });
    const k = REGISTRY() + toHex(this.deviceId) + '.' + grantId;
    const kept: Kept = JSON.parse((await AsyncStorage.getItem(k)) || 'null');
    await AsyncStorage.setItem(k, JSON.stringify({...kept, continued: true}));
  }

  /* the soft key's own buttons press for every request that waits on one */
  private pressing(onPress?: () => void) {
    return () => {
      this.pressWanted = () => undefined;
      onPress?.();
    };
  }

  /* ---- the inbox: requests waiting for the person ---- */

  /** A budget request made on this phone (testing mode); a computer's requests come over Bluetooth to edgeAgents instead, and the Worker (E5) is later. */
  request(from: string, reason: string, scopes: EdgeRequest['scopes']): number {
    const id = this.nextRequest++;
    this.requests.push({id, from, reason, scopes: scopes.map(sc => ({...sc}))});
    return id;
  }

  async pending() {
    return this.requests.map(r => ({...r, scopes: r.scopes.map(sc => ({...sc}))}));
  }

  /*
   * The copy R27 checks: every link this phone holds (with reveals) and the
   * opening of every budget it approved. A budget opened elsewhere has no
   * opening here, so a copy with its grant-create link does not verify -
   * fail closed, and the reason says which budget.
   *
   * ONE STORAGE READ (Pixel, 2026-10-07): this read every budget ever opened one
   * at a time (44 on the A13, growing) and loaded the whole copy again only to
   * hand back links nobody used - on every sync. Now one getMany, openings only.
   */
  private async openings() {
    const id = toHex(this.deviceId);
    let kept = openingsKept.get(id);
    if (!kept) {
      kept = new Map();
      const prefix = REGISTRY() + id + '.';
      const keys = (await this.storageKeys()).filter(k => k.startsWith(prefix));
      for (const [k, raw] of Object.entries(await AsyncStorage.getMany([...keys]))) {
        const rec: Kept | null = JSON.parse(raw || 'null');
        if (rec && rec.signature) kept.set(Number(k.slice(prefix.length)), openingOf(rec));
      }
      openingsKept.set(id, kept);
    }
    return Object.fromEntries(kept) as Record<number, unknown>;
  }

  /* R27 anchors for the banner: the KEY's public key (PUBKEY this session) and its checkpoints */
  async copyKey(opts: {checkpoint?: boolean} = {}): Promise<EdgeCopyKey> {
    const want = opts.checkpoint !== false;
    /* the key's Edge public key never changes for this device: read once a session */
    const id = toHex(this.deviceId);
    const publicKey = publicKeys.get(id) ?? (await this.edge.publicKey()).publicKey;
    publicKeys.set(id, publicKey);
    /* its ML-DSA-65 twin (hybrid, 2026-10-10): never changes either - read once a session, beside it */
    const publicKeyPq = publicKeysPq.get(id) ?? (await this.edge.publicKeyPq('checkpoint'));
    publicKeysPq.set(id, publicKeyPq);
    /* the key's latest checkpoint - once per action */
    const cached = this.sameHead && 'checkpoint' in this.sameHead ? this.sameHead.checkpoint : undefined;
    /* a checkpoint the key would not give leaves the copy "unsigned" - the log says why, or nobody can tell (2026-10-28) */
    const checkpoint = this.snap && 'checkpoint' in this.snap ? this.snap.checkpoint : cached !== undefined ? cached : want ? await this.edge.checkpoint().catch((e: unknown) => { console.warn(`[edge] checkpoint not read: ${(e as Error)?.message ?? e}`); return null; }) : null;
    /* only a checkpoint is kept for the action: a failed read (null) is asked again, not reused */
    if (want && this.snap && checkpoint) this.snap.checkpoint = checkpoint;
    if (want && this.sameHead && checkpoint) this.sameHead.checkpoint = checkpoint;
    return {publicKey, publicKeyPq, openings: await this.openings(), checkpoint};
  }

  /**
   * R27: the library's verdict on this phone's copy, against the key's live head.
   * A DISPLAY: keyTail lets the key's newest links (an agent's receipt written
   * after the last sync) be checked from the key in memory instead of read as a
   * gap - on the A13 that gap sent every check to the full 13-16 s one. The
   * approval (answerAgent verifyCopy) and the library's create/resume stay strict.
   */
  async check(): Promise<EdgeCopyCheck> {
    /* the one chain state (APP.md): not a check of its own */
    const a = await chainState.validity(this);
    if (a.ok) return {ok: true};
    const v = a.view.verdict as {kind: string; seq?: number; from?: number; to?: number};
    return {ok: false, reason: v.kind, seq: v.seq ?? v.from, to: v.to};
  }

  /* R27 for Approve and resume: the head the strict check verified, or a refusal */
  private async verifiedHead(): Promise<Uint8Array> {
    const s = await this.strictHead();
    if (!s.ok) throw new Error(`edge: this device's copy of the chain does not verify (${s.reason}) - sync or settle it first`);
    return s.head;
  }

  /*
   * THE LIBRARY'S STRICT CHECK BEFORE A BUDGET OPENS OR RESUMES (Brad, 2026-10-11: "checking every
   * field in a token means nothing if we never check the signature"). The one chain state welds
   * the links and checks the key's checkpoint, but it never checked the budget openings' own
   * signatures, the self-press spends or the scope rules - so a stored opening edited on the
   * phone would show as genuine and still pass. lib grants.check runs copy.verifyCopyKept with
   * the key's public keys, its live head, its checkpoint (both halves) and its ring, keeping
   * what it verified in memory so the next check reads only new links. Both must pass, at the
   * same head.
   */
  private async strictHead(): Promise<{ok: true; head: Uint8Array} | {ok: false; reason: string}> {
    const a = await chainState.validity(this);
    if (!a.ok || !a.head) return {ok: false, reason: a.view.verdict.kind};
    const mirror = await loadMirror(this.deviceId);
    /* an anchored copy (a new device): the strict check starts from its anchor too (lib copy.anchor) */
    const r = await this.edge.grants.check({links: mirror.links, openings: await this.openings(), ...(mirror.anchor ? {anchor: mirror.anchor} : {})}).catch((e: unknown) => ({ok: false, reason: String((e as Error)?.message ?? e)}));
    if (!r?.ok) return {ok: false, reason: `the strict check: ${r?.reason ?? 'not ok'}${r?.seq !== undefined ? ` at #${r.seq}` : ''}`};
    if (toHex(r.head) !== toHex(a.head.head)) return {ok: false, reason: 'the key moved during the check - try again'};
    return {ok: true, head: r.head};
  }

  /**
   * Yes -> the copy check (R27) -> GRANT_CREATE with the head it verified -> the
   * key waits for a PHYSICAL press (no press, no budget). A copy that does not
   * verify sends nothing. `onPress` says the key is waiting; press() presses it.
   */
  async approve(id: number, onPress?: () => void) {
    const r = this.requests.find(x => x.id === id);
    if (!r) throw new Error(`edge: no request ${id}`);
    const reasonHash = receipts.messageHash(r.reason);
    const g = await this.edge.grant({
      verifiedHead: await this.verifiedHead(),
      scopes: r.scopes,
      reasonHash,
      ttlMinutes: r.ttlMinutes ?? 0,
      onPress: () => {
        this.pressWanted = () => undefined;
        onPress?.();
      },
    });
    this.pressWanted = null;
    await this.keepOpening(g, {reason: r.reason, scopes: r.scopes, from: r.from, lifetime: r.ttlMinutes ?? 0});
    this.requests = this.requests.filter(x => x.id !== id);
  }

  /**
   * Keep a budget's opening on this phone - what R27 checks the copy against
   * (copy()). Every budget opened on this key must pass through here, or the
   * copy stops verifying at its grant-create link: the tab's Approve, an
   * agent's request, and the e2e suite (ctx.edgeCopy).
   */
  /*
   * THE LOGIN'S BUDGET, FILED LIKE ANY OTHER (lib identity.login onOpened / onUse; Brad, 2026-10-29: "after login, it gets
   * added into the budget history"): the login opens its budget through the lib before the Edge tab has a source, so
   * this files its opening words and each use's receipt message under the key's device id - the one the lib already
   * holds (edge.publicKey, no request after the first). The tab's history lists it; the copy checks its links.
   */
  static loginFiler(edge: any, from: string) {
    let at: Promise<SoftKeyEdge> | null = null;
    const me = () => (at ??= edge.publicKey().then((p: {deviceId: Uint8Array}) => new SoftKeyEdge(edge, p.deviceId)));
    return {
      onOpened: async (g: any, o: {reason: string; scopes: any[]; lifetime: number}) => { await (await me()).keepOpening(g, {...o, from}); },
      onUse: async (u: {seq: number; message: string}) => { await require('./edgeStore').addNote((await me()).deviceId, {computer: '', seq: u.seq, receiptMsg: u.message}); },
    };
  }

  async keepOpening(g: any, o: {reason: string; scopes: any[]; from: string; lifetime: number; computer?: string}) {
    const kept: Kept = {
      v: 1,
      reason: o.reason, scopes: o.scopes, uses: g.uses, genesis: typeof g.genesis === 'string' ? g.genesis : toHex(g.genesis), from: o.from,
      signature: typeof g.checkpoint.signature === 'string' ? g.checkpoint.signature : toHex(g.checkpoint.signature),
      lifetime: o.lifetime, opened: Date.now(), ...(o.computer ? {computer: o.computer} : {}),
    };
    await AsyncStorage.setItem(REGISTRY() + toHex(this.deviceId) + '.' + g.grantId, JSON.stringify(kept));
    openingsKept.get(toHex(this.deviceId))?.set(g.grantId, openingOf(kept)); /* the memory follows our own write */
  }

  /**
   * An EDGE_REQUEST from a paired computer (APP.md), from the vendor
   * bridge: the library's one implementation decides (approve.approveRequest - drop the
   * malformed and replayed, check caps and lifetime, ask the person, labels
   * and the reason hash made HERE from the names and the text, R27 on this
   * phone's copy, GRANT_LABEL + GRANT_CREATE, the press). An opened budget is
   * kept like one approved on the tab, so the copy keeps verifying and the
   * tab lists it.
   */
  async answerAgent(msg: any, o: {seen: Set<string>; from: string; computer: string | null; ask: (view: any) => Promise<'approve' | 'decline' | 'timeout' | 'copy_unverified'>; onPress?: () => void}) {
    const r: any = await approveLib.approveRequest(msg, {
      edge: this.edge,
      from: o.computer,
      seen: o.seen,
      ask: o.ask,
      /* the one chain state AND the library's strict check (strictHead): only a copy both verify gives a head */
      verifyCopy: async () => {
        const s = await this.strictHead();
        if (!s.ok) console.log(`[edge] approve: refused - ${s.reason}`);
        /* a refusal: approveRequest looks at ok first, so the empty head is never used */
        return s.ok ? {ok: true, head: s.head} : {ok: false, head: new Uint8Array(0)};
      },
      budgetOf: (id: number) => this.keptSync.get(id) ?? null,
      coverOf: (m: any) => this.coverOf(m, o.computer),
      onPress: () => {
        this.pressWanted = () => undefined;
        o.onPress?.();
      },
      timeoutMs: 30000,
    });
    this.pressWanted = null;
    if (r.ok) {
      await this.keepOpening(r.budget, {
        reason: msg.reason, scopes: requestLib.grantScopes(msg), from: o.from, lifetime: msg.lifetime, ...(o.computer ? {computer: o.computer} : {}),
      });
    }
    return r;
  }

  /* the budgets this phone opened for a paired computer, for a continue: {from, scopes} by id (loaded by loadAgentBudgets) */
  private keptSync = new Map<number, {from: string; scopes: any[]}>();
  async loadAgentBudgets() {
    const prefix = REGISTRY() + toHex(this.deviceId) + '.';
    this.keptSync.clear();
    for (const k of await AsyncStorage.getAllKeys()) {
      if (!k.startsWith(prefix)) continue;
      const kept: Kept | null = JSON.parse((await AsyncStorage.getItem(k)) || 'null');
      if (kept?.computer) {
        /* the request's own words for the ops: a continue's scopes are compared with them */
        const scopes = kept.scopes.map((sc: any) => ({...sc, op: sc.op === codes.OP.SIGN ? 'sign' : sc.op === codes.OP.DECRYPT ? 'decrypt' : sc.op}));
        this.keptSync.set(Number(k.slice(prefix.length)), {from: kept.computer, scopes});
      }
    }
  }

  /** The press, on the soft key's own buttons - the phone is also the key, so it proves less than a hard key's. */
  async press() {
    await OkEmu.pressQueue('1');
  }

  async decline(id: number) {
    this.requests = this.requests.filter(x => x.id !== id); /* nothing reaches the key */
  }
}


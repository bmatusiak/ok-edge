/*
 * THIS DEVICE IN ITS IDENTITY'S ROOM ON THE USER'S SERVER (ok-edge plan M2/M3; Brad, 2026-10-26: "when a key gets
 * plugged into the webapp, its a blank bucket, and we need to get remote buckets from other devices that are connected
 * to the same service"; "the desktop app and mobile app are remotes too - they can connect to the websocket server they
 * choose").
 *
 * ONE CODE FOR EVERY SHELL; only the address differs. The web app was served by the user's server (mcp-server/), so its
 * room is on the page's own origin - nothing to type. The phone and the desktop are told the address once, in the Sync
 * tab's Server panel (src/ui/ServerPanel.tsx), kept on the device.
 *
 * Once the identity check has opened the bucket, the device joins its identity's room with the key's proof (lib
 * bucket/src/room-client.js: the bucket key over the server's host and a fresh nonce - no code, no account), then:
 *   - ANSWERS the trades other devices start (bucketTrade.ts handleTrade - the peer side the phone answers over
 *     Bluetooth too);
 *   - STARTS one with each device online - when it joins, and when another comes online - so a blank bucket fills from
 *     whoever is there, and a change made here reaches them. One trade at a time; the merge rules settle both ways.
 * Frames are sealed between the devices of the identity; the server passes ciphertext.
 *
 * Here: the bucket opened in memory (the web app, the phone). The desktop keeps its bucket in the file its sync
 * service shares with the CLI, so it joins through that service (lib `bucket sync --server`).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as bucketLib from 'node-onlykey-lib/bucket';
import {handleTrade, proofMaterial} from './bucketTrade';
import {saveTradedBucket, tradeBucket} from './bucketStore';
import {RULES} from './bucketRules';
import {phoneSyncTraded} from './sync';
import {deviceName, shell} from './platform';
import {activeBackend} from './hooks/KeyContext';
import {attachAgents, detachAgents} from './mcpAgents';
import {ioPulse} from './btActivity';

declare const crypto: {getRandomValues<T extends Uint8Array>(array: T): T};
declare const location: {origin: string; host: string} | undefined;
declare const navigator: {userAgent?: string} | undefined;
const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));

const DEVICE_KEY = 'okedge.room.device';
const SERVER_KEY = 'okedge.room.server';
const REJOIN_MS = 15000;
/* one trade message's answer: a GIVE of post-quantum keys is large; the peer may ask its key for presses the first time */
const ANSWER_MS = 120000;

export type RoomPeer = {id: string; name: string; kind: string};
export type RoomState = {
  /* the server this device joins, or null (no site on the key, or a web page off the key's site) */
  url: string | null;
  /* the key's site - the server it belongs to (ctap_bridge), read at the identity check; null when it has none */
  site: string | null;
  status: 'off' | 'joining' | 'joined' | 'error';
  why: string | null;
  you: RoomPeer | null;
  peers: RoomPeer[];
  /* the last trade this device started: with whom, when, and what came of it */
  last: {with: string; at: number; line: string} | null;
  /* the last failure needs the key (its bucket key was not made): only the person tries again */
  needsKey: boolean;
};

let state: RoomState = {url: null, site: null, status: 'off', why: null, you: null, peers: [], last: null, needsKey: false};
const listeners = new Set<(s: RoomState) => void>();
const set = (patch: Partial<RoomState>) => {
  state = {...state, ...patch};
  for (const l of [...listeners]) l(state);
};
export const roomState = () => state;
export function onRoomState(l: (s: RoomState) => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/*
 * THE KEY SAYS WHERE ITS SYNC LIVES (Brad, 2026-10-27: "during identity check we can use the rpid to connect to the
 * mcp for bucket sync in desktop and mobile app - so the firmware tells where the bucket sync can live on the
 * internet"; "for the webapp it should be using the same domain set for the rpid - that is what I think should help
 * protect in production"). The identity check reads the key's site (ctap_bridge's, okcrypto.keySite) and sets it here.
 *   - the phone and the desktop join https://<site>; a typed address (the Server panel) is a TESTING override only -
 *     a local server on another port;
 *   - the web app joins its own page's server ONLY when the page is on the key's site: a page anywhere else - even a
 *     site the key also trusts - does not sync. The key will not answer a site it does not trust; this keeps a site
 *     it does trust from being taken for the person's server.
 */
let keySite: string | null = null;
export function setKeySite(site: string | null): void {
  const changed = site !== keySite;
  keySite = site;
  set({site});
  if (changed) { leaveServerRoom(); void joinServerRoom(); }
}

export async function serverUrl(): Promise<string | null> {
  if (shell === 'webapp' && typeof location !== 'undefined') {
    /* the page's host without its port: an rpId is a name, never a port (a local server is apps.crp.to:8787) */
    return keySite && location.host.split(':')[0] === keySite ? location.origin : null;
  }
  const override = await AsyncStorage.getItem(SERVER_KEY);
  if (override) return override;
  return keySite ? `https://${keySite}` : null;
}

/** Set (or clear, with null) the server the phone/desktop joins; joins it at once when a bucket is open. */
export async function setServerUrl(url: string | null): Promise<void> {
  if (url) {
    const u = new URL(url);
    if (u.protocol !== 'https:' && !/^(localhost|127\.0\.0\.1)$/.test(u.hostname)) throw new Error('a server address is https:// (http only for this computer itself)');
    await AsyncStorage.setItem(SERVER_KEY, u.origin);
  } else {
    const typed = await AsyncStorage.getItem(SERVER_KEY);
    await AsyncStorage.removeItem(SERVER_KEY);
    /*
     * A TYPED SERVER LEFT GOES BACK TO THE KEY'S (Brad, 2026-10-30: the firmware says which server - "directly from
     * the firmware, instead of a flag"). Leaving a testing override (the Pixel on the box's server) left the phone
     * with no server at all; the key's own server is the one it belongs in. Leaving the key's server itself, with no
     * override, is still no server for this run.
     */
    if (typed) {
      leaveServerRoom();
      const back = await serverUrl();
      set({url: back});
      if (back) void joinServerRoom();
      return;
    }
  }
  leaveServerRoom();
  set({url: url ? new URL(url).origin : null});
  if (url) void joinServerRoom();
}

/* how this device shows in the room: one id for good (this device's storage), a name that says what it is */
async function thisDevice(): Promise<RoomPeer> {
  let id = await AsyncStorage.getItem(DEVICE_KEY);
  if (!id || !/^[0-9a-f]{16}$/.test(id)) {
    id = Array.from(randomBytes(8), b => b.toString(16).padStart(2, '0')).join('');
    await AsyncStorage.setItem(DEVICE_KEY, id);
  }
  /*
   * this device's kind (platform deviceName) and THE KEY IN USE - the desktop on key 3 called itself "Desktop (soft key)"
   * when the name was fixed per shell (2026-10-30)
   */
  return {id, name: `${deviceName()} (${activeBackend() === 'usb' ? 'hard key' : 'soft key'})`, kind: shell};
}

let room: any = null;
let joining = false;
let joinedFor: string | null = null;
let tradeChain: Promise<void> = Promise.resolve();

/** Leave the room (the address changed, or the bucket closed). */
export function leaveServerRoom(): void {
  const r = room;
  room = null;
  joinedFor = null;
  if (r) r.close();
  detachAgents();
  set({status: 'off', why: null, you: null, peers: []});
}

/** Join the open bucket's room on this device's server, once; nothing when no bucket is open, no server, or joined. */
export async function joinServerRoom(): Promise<void> {
  const open = tradeBucket();
  const url = await serverUrl();
  set({url});
  if (!open || !url || joining || (room && joinedFor === open.identity)) return;
  joining = true;
  set({status: 'joining', why: null, needsKey: false});
  /*
   * THE KEY IS NEVER ASKED ON A TIMER (Brad, 2026-10-26: "for some reason it keeps making key requests"): the first join
   * makes this device's bucket key - two key requests - and a join retried every few seconds asked them again and again.
   * A failure there waits for the person (the Server panel's Try again); only a connection that drops is retried, and
   * that needs no key: the proof material is kept once made.
   */
  let me: Awaited<ReturnType<typeof proofMaterial>> = null;
  try {
    me = await proofMaterial();
  } catch (e) {
    const why = String((e as Error)?.message ?? e);
    console.log(`[room] the key did not make this device's bucket key: ${why}`);
    set({status: 'error', why: `the key did not answer (${why}) - Try again asks it once more`, needsKey: true});
    joining = false;
    return;
  }
  if (!me) { set({status: 'error', why: 'no proof material for the open bucket (its key is another identity)', needsKey: true}); joining = false; return; }
  try {
    const device = await thisDevice();
    const r = await bucketLib.roomClient.connectRoom({url, me, device, WebSocket: (globalThis as any).WebSocket, randomBytes});
    room = r;
    joinedFor = me.id;
    retries = 0;
    set({status: 'joined', why: null, you: device, peers: r.peers()});
    console.log(`[room] joined ${new URL(url).host} as ${device.name}: ${r.peers().length} other device(s) online`);
    /* the room was joined with the key's proof, so it may trade while the bucket it joined for is open */
    r.serve(async (from: string, message: any) => {
      const out: any = await handleTrade(message, from, {allowed: () => tradeBucket()?.identity === me.id});
      /* a trade another device started, answered here: it is this device's last trade too (the ⇄ shows it, as its own) */
      if (message?.type === bucketLib.trade.TYPES.GIVE && out?.ok) {
        const who = r.peers().find((p: RoomPeer) => p.id === from);
        set({last: {with: who ? who.name : from, at: Date.now(), line: 'traded - answered its trade'}});
      }
      return out;
    });
    /* the agents that ask this identity (the server's /mcp): their plans, live, and the owner's answers (mcpAgents.ts) */
    attachAgents(r, Array.from(me.identityPublicKey as Uint8Array, (b: number) => b.toString(16).padStart(2, '0')).join(''));
    r.on('peer', (p: any) => {
      set({peers: r.peers()});
      console.log(`[room] ${p.up ? `${p.up.name} (${p.up.kind}) came online` : `${p.down} left`}`);
      if (p.up) tradeSoon(p.up);
    });
    r.on('close', () => {
      /* a room left for another (a new server, a new key site) closes a moment later: not this device's room */
      if (room !== r) { console.log('[room] the previous room\'s connection closed'); return; }
      console.log('[room] the connection closed - joining again shortly');
      room = null;
      joinedFor = null;
      set({status: 'error', why: 'the connection closed - joining again shortly', peers: []});
      rejoinLater();
    });
    for (const p of r.peers()) tradeSoon(p);
    sealedSoon('joined');
  } catch (e) {
    const why = String((e as Error)?.message ?? e);
    console.log(`[room] not joined: ${why}`);
    set({status: 'error', why});
    rejoinLater();
  } finally {
    joining = false;
  }
}

/* a dropped or refused connection: again after 15 s, 30 s, 1 min ... up to 5 min (no key is asked - see above) */
let retries = 0;
function rejoinLater(): void {
  const wait = Math.min(300000, REJOIN_MS * 2 ** retries);
  retries += 1;
  setTimeout(() => { void joinServerRoom(); }, wait);
}

/*
 * THE BUCKET CHANGED HERE (Brad, 2026-10-29: "because the bucket changes, it will upload the bucket changes back to mcp" -
 * edgeSoftKey fileOwnLog, this key's log filed): a trade with every device in the room now, under the same rule as a
 * join (tradeSoon: one starter per pair; a CLI starts its own). Not joined: nothing - the next join trades.
 */
export function bucketChanged(): void {
  if (!room) return;
  for (const p of room.peers()) tradeSoon(p);
  sealedSoon('this bucket changed');
}

/*
 * THE SERVER'S SEALED COPY (lib bucket/src/sealedcopy.js; Phase 3; Brad, 2026-10-29: "we load the key on a fresh session
 * empty, and it then needs to compare the remote and session, and decide"). At each join and each change here: the
 * room's table (keyed ids and change tags, a few KB) against this bucket's, then only the rows that differ - the server's
 * newer ones taken through the stores' own rules, this side's put sealed. With the heads row: each Edge log's newest link
 * the copy holds. Whoever is online or not, a fresh session catches up from it. In the trades' queue: one change to the
 * bucket at a time. A server not set to keep this identity: said once, nothing sent.
 */
let sealedSaid = '';
function sealedSoon(why: string): void {
  tradeChain = tradeChain.then(() => sealedSync(why)).catch((e: unknown) => console.log(`[room] the sealed copy: not synced - ${String((e as Error)?.message ?? e)}`));
}
async function sealedSync(why: string): Promise<void> {
  const r = room;
  const open = tradeBucket();
  const me = await proofMaterial();
  if (!r || !open || !me) return;
  const store = r.sealedStore();
  if (!(await store.on())) {
    if (sealedSaid !== 'off') { sealedSaid = 'off'; console.log('[room] the sealed copy: this server keeps none for this identity'); }
    return;
  }
  const {logblocks} = require('node-onlykey-lib/edge');
  const entries = (name: string) => Object.fromEntries(Object.entries((open.bucket.stores[name] ?? {}) as Record<string, {v: string | null; archived?: boolean}>).filter(([, x]) => x && !x.archived && x.v !== null).map(([k, x]) => [k, x.v as string]));
  const heads = {...logblocks.newestSeqs(entries('edge-logs')), ...logblocks.newestSeqs(entries('edge-logs-test'))};
  ioPulse('sync');
  const res = await bucketLib.sealedCopy.syncWith(open.bucket, bucketLib.sealedCopy.keysOf(me.bucketKey), store, {rules: RULES, randomBytes, heads});
  for (const x of res.refused) console.log(`[room] the sealed copy: a row refused - ${x}`);
  if (count(res.taken)) {
    await saveTradedBucket();
    phoneSyncTraded(res.taken);
  }
  sealedSaid = 'on';
  console.log(`[room] the sealed copy (${why}): got ${res.got}, put ${res.put}${count(res.taken) ? ` - took ${JSON.stringify(res.taken)}` : ''}`);
}

/** The Server panel's Try again: one more join, which asks the key again when it has to. */
export function retryServerRoom(): void {
  retries = 0;
  void joinServerRoom();
}

/*
 * ONE STARTER PER PAIR: two devices that both start a trade with each other run two trades at once, each mid-way when
 * the other changes the bucket. A CLI starts its own (its sync is one-shot: it starts, never answers); between two apps
 * the one with the lower id starts, the other answers. One trade at a time, in the order asked.
 */
function tradeSoon(peer: RoomPeer): void {
  const mine = state.you?.id ?? '';
  if (peer.kind === 'cli' || (mine && peer.id < mine)) return;
  tradeChain = tradeChain.then(() => tradeWith(peer)).catch((e: unknown) => {
    const line = `not traded: ${String((e as Error)?.message ?? e)}`;
    console.log(`[room] ${peer.name}: ${line}`);
    set({last: {with: peer.name, at: Date.now(), line}});
  });
}

const count = (o: Record<string, number> | undefined) => Object.values(o || {}).reduce((a, b) => a + Number(b), 0);

/*
 * THIS DEVICE'S SIDE OF A TRADE (lib bucket/src/trade.js computerSide, as bucket/cli/trade.js runs it): proofs both
 * ways, the states, then HAVE/GIVE rounds until they match. It runs on the bucket open here, as the peer side does;
 * what it took is stored as a traded bucket is.
 */
async function tradeWith(peer: RoomPeer): Promise<void> {
  const r = room;
  const open = tradeBucket();
  const me = await proofMaterial();
  if (!r || !open || !me) return;
  /* the ⇄ flashes for every trade message this device sends in the room (btActivity 'sync') */
  const send = (m: any) => { ioPulse('sync'); return r.request(peer.id, m, {timeoutMs: ANSWER_MS}); };
  const c = bucketLib.trade.computerSide({bucket: open.bucket, me, randomBytes, rules: RULES});
  const m2 = c.prove(await send(c.hello()));
  const done = (line: string) => {
    console.log(`[room] ${peer.name}: ${line}`);
    set({last: {with: peer.name, at: Date.now(), line}});
  };
  if (!m2) return done('refused - it did not prove this bucket identity, or does not trade');
  let step = c.compare(await send(m2));
  if (!step) return done('it did not say its state');
  if (step.same) return done('in sync');
  const taken: Record<string, number> = {};
  let gave = 0;
  let settled = false;
  for (;;) {
    const g = c.give(await send(step.message));
    if (!g) break;
    for (const [s, n] of Object.entries(g.taken || {})) taken[s] = (taken[s] || 0) + Number(n);
    const s = c.settle(await send(g.message));
    if (!s) break;
    gave += count(s.taken);
    if (s.same) { settled = true; break; }
    if (!s.message) break;
    step = s;
  }
  if (count(taken)) {
    await saveTradedBucket();
    phoneSyncTraded(taken);
  }
  done(`${settled ? 'traded' : 'not settled'} - took ${count(taken)}, gave ${gave}`);
}

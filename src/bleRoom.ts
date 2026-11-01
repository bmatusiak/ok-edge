/*
 * THIS PHONE IN ITS IDENTITY'S ROOM ON A COMPUTER'S MCP-SERVER, OVER BLUETOOTH (ok-edge plan B3; Brad, 2026-11-01: "the
 * mcp server should make communication with ble transparent - the phone asks over ble to talk to the mcp-server like it
 * was connected to it over websockets"; "the app authorizes/approves ble over to the host using the same mechanism, so
 * that way we re-use code that we already have").
 *
 * The computer holds the link (its mcp-server's ble.js) and says its name (HERE). This phone then dials its identity's
 * room there exactly as it dials the user's server: the lib's room client over a WebSocket-shaped class whose frames
 * ride the Bluetooth link (node-onlykey-lib transport/ble-socket createSocketLink), the room's challenge signed with the
 * login proof (identity.proveLogin - a press, or the login budget's), and the joined room wired as the server's is
 * (serverRoom.ts wireRoom: trades with the devices there, the computer's sealed copy, its agents). So a phone and a
 * computer sync with no internet, by the same code that syncs them through the user's server.
 *
 * THE DOOR: only frame command 0x86 (the socket) is heard; every other vendor message gets silence, as before. The
 * native layer passes only the TARGET computer's writes (the Bluetooth tab's Target - one computer at a time).
 * THE KEY IS NEVER ASKED ON A TIMER (serverRoom.ts): a login proof is one connection's, so a dropped link or a refused
 * join waits for the person's Try again (the Sync tab's Server panel), never a retry.
 */
import * as bucketLib from 'node-onlykey-lib/bucket';
import * as bleSocket from 'node-onlykey-lib/transport/ble-socket';
import {bytes as okbytes} from 'node-onlykey-lib';
import NativeFidoGatt from 'okedge-native/specs/NativeFidoGatt';
import FidoGatt from './transport/FidoGatt';
import {tradeBucket} from './bucketStore';
import {proofMaterial} from './bucketTrade';
import {thisDevice, wireRoom, type RoomHooks, type RoomPeer, type RoomState} from './serverRoom';
import {detachAgents} from './mcpAgents';
import {getOnlyKey} from './onlykey';
import {activeBackend} from './hooks/KeyContext';
import {challengeOpts} from './hostChallenge';

declare const crypto: {getRandomValues<T extends Uint8Array>(array: T): T};
const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));

export type BleRoomState = {
  /* the computer's name (its HERE) while its link is up, else null */
  host: string | null;
  status: 'off' | 'linked' | 'joining' | 'joined' | 'error';
  why: string | null;
  peers: RoomPeer[];
  /* the last failure needs the key: only the person tries again */
  needsKey: boolean;
  sealed: RoomState['sealed'];
};
const NO_SEALED: RoomState['sealed'] = {status: 'unknown', at: null, why: null, stores: {}, stale: [], newer: [], newerUnknown: 0, tier: null};
let state: BleRoomState = {host: null, status: 'off', why: null, peers: [], needsKey: false, sealed: NO_SEALED};
const listeners = new Set<(s: BleRoomState) => void>();
const set = (patch: Partial<BleRoomState>) => {
  state = {...state, ...patch};
  for (const l of [...listeners]) l(state);
};
export const bleRoomState = () => state;
export function onBleRoomState(l: (s: BleRoomState) => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

const HOOKS: RoomHooks = {
  tag: '[room ble]',
  where: 'ble',
  peers: (r) => set({peers: r.peers()}),
  sealed: (s) => set({sealed: {...state.sealed, ...s}}),
  newer: (stores, unknown) => set({sealed: {...state.sealed, newer: [...new Set([...state.sealed.newer, ...stores])].sort(), newerUnknown: state.sealed.newerUnknown + unknown}}),
};

/* sends one at a time: the native notify budget is per link, and fragments reassemble by position */
let sending: Promise<void> = Promise.resolve();
const sendFrame = (payload: Uint8Array) => {
  const hex = okbytes.toHex(payload);
  sending = sending.then(() => NativeFidoGatt.sendVendorFrame(bleSocket.CMD_SOCKET, hex)).catch((e: unknown) => {
    console.log(`[room ble] a frame was not sent: ${String((e as Error)?.message ?? e)}`);
  });
  return sending;
};
const link = bleSocket.createSocketLink({sendFrame});

let room: any = null;
let joining = false;
let started = false;

/**
 * Listen for the computer's socket messages - once, where the vendor door opens (useFidoGatt). The computer's name
 * arriving (HERE) joins the room when a bucket is open; the link going closes it.
 */
export function startBleRoom(): void {
  if (started) return;
  started = true;
  FidoGatt.on('request', ev => {
    if (ev.iface !== 'vendor' || (Number(ev.command) & 0x7f) !== (bleSocket.CMD_SOCKET & 0x7f)) return;
    link.push(okbytes.fromHex(ev.hex));
  });
  FidoGatt.on('status', ev => {
    if (ev.state === 'connected' || !state.host) return;
    console.log(`[room ble] the computer's link went (${ev.state})`);
    link.down(`the Bluetooth link went (${ev.state})`);
    set({host: null, status: 'off', why: null, peers: []});
  });
  link.onHere((host: string) => {
    console.log(`[room ble] ${host} is linked - its mcp-server's room is this phone's over Bluetooth`);
    set({host, status: room ? state.status : 'linked', why: null});
    void joinBleRoom();
  });
}

/*
 * THE TARGET IS SET (useFidoGatt, after the radio is told): the computer's name is asked again - its HERE came when the
 * link came up, and the native gate dropped it if this computer was not the target yet (the Pixel, 2026-11-01: linked
 * at 12:41:04, targeted at 12:41:45, never joined). Also the app restarted while the link stayed up.
 */
export function bleTargetSet(): void {
  if (!started) return;
  link.where();
}

/** Join the open bucket's room on the linked computer - nothing when no computer is linked, no bucket, or joined. */
export async function joinBleRoom(): Promise<void> {
  const host = state.host;
  const open = tradeBucket();
  if (!enabled || !host || !open || joining || room) return;
  joining = true;
  set({status: 'joining', why: null, needsKey: false});
  const prove = challengeOpts(`Proving this key holds the identity to ${host}`);
  try {
    const me = await proofMaterial();
    if (!me || me.id !== open.identity) throw new Error('no bucket key for the open bucket');
    const app = await getOnlyKey(activeBackend());
    const device = await thisDevice();
    const r = await bucketLib.roomClient.connectRoom({
      url: `ble://${host}`, device, WebSocket: link.WebSocket, randomBytes,
      /* the login proof for THIS connection's challenge - a Bluetooth room always asks it (mcp-server core room.js) */
      me: {id: me.id, identityPublicKey: me.identityPublicKey, bucketKey: me.bucketKey, certificate: new Uint8Array(0)},
      login: (q: {host: string; nonce: Uint8Array}) => app.identity.proveLogin(q, me.bucketKey.publicKey, {confirm: prove.opts.confirm}),
      timeoutMs: 60000,
    });
    room = r;
    console.log(`[room ble] login: ${me.id.slice(0, 12)}: proven to the server (${host}) - the key signed its challenge`);
    console.log(`[room ble] joined ${host} as ${device.name}: ${r.peers().length} other device(s) online`);
    set({status: 'joined', why: null, peers: r.peers()});
    r.on('close', () => {
      if (room !== r) return;
      room = null;
      detachAgents('ble');
      /* the proof was that connection's: the key is asked again only by the person */
      console.log('[room ble] the room closed - Try again logs in to it again');
      set({status: state.host ? 'error' : 'off', why: state.host ? 'the room closed - Try again asks the key to log in to it again' : null, peers: [], needsKey: Boolean(state.host)});
    });
    wireRoom(r, me, HOOKS);
  } catch (e) {
    const why = String((e as Error)?.message ?? e);
    console.log(`[room ble] not joined: ${why}`);
    set({status: 'error', why, needsKey: true});
  } finally {
    prove.done();
    joining = false;
  }
}

/*
 * THE BLUETOOTH MCP SWITCH (the Bluetooth tab; useFidoGatt tells it with the radio's gate): off, this phone leaves the
 * computer's room and joins none; on, it joins when a computer is linked and a bucket is open.
 */
let enabled = false;
export function setBleMcp(on: boolean): void {
  if (on === enabled) return;
  enabled = on;
  console.log(`[room ble] Bluetooth MCP ${on ? 'on' : 'off'}`);
  if (!on) { leaveBleRoom(); link.down('Bluetooth MCP switched off'); set({host: null, status: 'off', why: null, peers: []}); }
}
export const bleMcpOn = () => enabled;

/** The Server panel's Try again for the Bluetooth room. */
export function retryBleRoom(): void {
  void joinBleRoom();
}

/** Leave the Bluetooth room (the bucket closed); the link stays the computer's. */
export function leaveBleRoom(): void {
  const r = room;
  room = null;
  if (r) r.close();
  detachAgents('ble');
  set({status: state.host ? 'linked' : 'off', why: null, peers: [], needsKey: false, sealed: NO_SEALED});
}

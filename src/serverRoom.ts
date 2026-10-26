/*
 * THE WEB APP IN ITS IDENTITY'S ROOM ON THE USER'S SERVER (ok-edge plan M2; Brad, 2026-10-26: "when a key gets plugged
 * into the webapp, its a blank bucket, and we need to get remote buckets from other devices that are connected to the
 * same service").
 *
 * The page was served by the user's server (mcp-server/), so the room is on the page's own origin - no address to type.
 * Once the identity check has opened the bucket, the page joins its identity's room with the key's proof (lib
 * bucket/src/room-client.js: the bucket key over this host and a fresh nonce) and answers the trades the other devices
 * of the identity start (bucketTrade.ts handleTrade - the same peer side the phone answers over Bluetooth). Frames are
 * sealed between the devices; the server passes ciphertext.
 *
 * Joined once per open bucket; a dropped connection is joined again after a pause while the bucket stays open.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as bucketLib from 'node-onlykey-lib/bucket';
import {handleTrade, proofMaterial} from './bucketTrade';
import {tradeBucket} from './bucketStore';

declare const crypto: {getRandomValues<T extends Uint8Array>(array: T): T};
declare const location: {origin: string; host: string};
declare const navigator: {userAgent?: string} | undefined;
const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));

const DEVICE_KEY = 'okedge.room.device';
const REJOIN_MS = 15000;

/* how this browser shows in the room: one id for good (this browser's storage), the browser's name */
async function thisDevice(): Promise<{id: string; name: string; kind: 'webapp'}> {
  let id = await AsyncStorage.getItem(DEVICE_KEY);
  if (!id || !/^[0-9a-f]{16}$/.test(id)) {
    id = Array.from(randomBytes(8), b => b.toString(16).padStart(2, '0')).join('');
    await AsyncStorage.setItem(DEVICE_KEY, id);
  }
  const ua = String(navigator?.userAgent ?? '');
  const name = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'browser';
  return {id, name: `${name} (web app)`, kind: 'webapp'};
}

let room: any = null;
let joining = false;
let joinedFor: string | null = null;

/** Join the open bucket's room on this page's server, once; nothing when no bucket is open or already joined. */
export async function joinServerRoom(): Promise<void> {
  const open = tradeBucket();
  if (!open || joining || (room && joinedFor === open.identity)) return;
  joining = true;
  try {
    const me = await proofMaterial();
    if (!me) { console.log('[room] no proof material for the open bucket - not joined'); return; }
    const device = await thisDevice();
    const r = await bucketLib.roomClient.connectRoom({url: location.origin, me, device, WebSocket: (globalThis as any).WebSocket, randomBytes});
    room = r;
    joinedFor = me.id;
    console.log(`[room] joined ${location.host} as ${device.name}: ${r.peers().length} other device(s) online`);
    /* the room was joined with the key's proof, so it may trade while the bucket it joined for is open */
    r.serve((from: string, message: any) => handleTrade(message, from, {allowed: () => tradeBucket()?.identity === me.id}));
    r.on('peer', (p: any) => console.log(`[room] ${p.up ? `${p.up.name} (${p.up.kind}) came online` : `${p.down} left`}`));
    r.on('close', () => {
      console.log('[room] the connection closed');
      if (room === r) { room = null; joinedFor = null; }
      setTimeout(() => { void joinServerRoom(); }, REJOIN_MS);
    });
  } catch (e) {
    console.log(`[room] not joined: ${String((e as Error)?.message ?? e)}`);
    setTimeout(() => { void joinServerRoom(); }, REJOIN_MS);
  } finally {
    joining = false;
  }
}

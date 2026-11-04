/*
 * THE DESKTOP'S LOCAL MCP (Brad, 2026-11-01: "if remote mcp server is alive, auth with that, not with local - the local
 * mcp has no auth, but it still will communicate with the desktop app for the planner and budget calls").
 *
 * The local MCP runs in the desktop's main process (electron/desktop/localMcp.js - mcp-server's core + localhost, on
 * 127.0.0.1, OPEN_JOIN). The login never goes through it: the key proves itself to the user's server, or to this app
 * (serverRoom logIn, bucketStore). Once the bucket is open, the app joins this room with no proof and nothing of the key
 * (lib connectRoom: no bucket key - a throwaway one) - only to hear this computer's agents (their plans, their budget
 * calls) and answer them (mcpAgents.ts). It goes at logout or with the key.
 */
import * as bucketLib from 'node-onlykey-lib/bucket';
import {invokeSync} from './desktop/specs/module';
import {LOCAL_MCP_HERE} from './platform';
import {getOnlyKey} from './onlykey';
import {activeBackend} from './hooks/KeyContext';
import {attachAgents, detachAgents} from './mcpAgents';

const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));
let room: any = null;
let roomFor: string | null = null;
let joining = false;

/* the local MCP's base URL - the desktop only, and only once it is up (null: not here, or it did not start) */
export function localMcpUrl(): string | null {
  return LOCAL_MCP_HERE ? invokeSync<string>('okedge:localMcp') : null;
}

/* host:port with this computer's two names as one (the Server panel takes either) */
const hostOf = (u: string) => {
  const {hostname, port} = new URL(u);
  return `${hostname === 'localhost' ? '127.0.0.1' : hostname}:${port}`;
};

/** Join the local MCP's room for this identity, once (no proof, nothing asked of the key); its agents shown and answered. */
export async function joinLocalRoom(identity: string): Promise<void> {
  const url = localMcpUrl();
  const id = identity.toLowerCase();
  if (!url || joining || (room && roomFor === id)) return;
  joining = true;
  try {
    /*
     * THE USER'S SERVER MAY BE THIS ROOM ITSELF (2026-11-02, Windows: the Server panel set to http://127.0.0.1:8650 for the
     * batches). Then the server room is already this computer's room, its agents heard there (wireRoom) - a second join as
     * the same device replaced the proven one (4409) and dropped the sync.
     */
    const server = await require('./serverRoom').serverUrl();
    if (server && hostOf(server) === hostOf(url)) return;
    const held = await (await getOnlyKey(activeBackend())).identity.load();
    if (held.id !== id) return;
    const device = await require('./serverRoom').thisDevice();
    leaveLocalMcp();
    const r = await bucketLib.roomClient.connectRoom({url, device, WebSocket: (globalThis as any).WebSocket, randomBytes, me: {id, identityPublicKey: held.publicKey, bucketKey: null}});
    room = r;
    roomFor = id;
    attachAgents(r, Array.from(held.publicKey as Uint8Array, (b: number) => b.toString(16).padStart(2, '0')).join(''), 'local');
    r.on('close', () => { if (room === r) { room = null; roomFor = null; } });
    console.log(`[local-mcp] joined this computer's room for ${id.slice(0, 12)} (${new URL(url).host}) - its agents' plans come here`);
  } catch (e) {
    console.log(`[local-mcp] not joined: ${String((e as Error)?.message ?? e)}`);
  } finally {
    joining = false;
  }
}

/* the local room left: at logout, at a lock, with the key */
export function leaveLocalMcp(): void {
  if (room) { try { room.close(); } catch { /* closed already */ } }
  room = null;
  roomFor = null;
  detachAgents('local');
}

/* the key forgotten (a lock, an unplug, the Log in page - its identity plugin): this, which stays loaded, lets go of it */
require('./onlykey').onKeyForgotten(() => leaveLocalMcp());

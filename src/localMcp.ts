/*
 * THE DESKTOP LOGS IN TO ITS LOCAL MCP (Brad, 2026-11-01: "the login plan needs to check mcp to challenge the identity";
 * "so the desktop checks itself over its local mcp"; "so the desktop can re-use the core and websocket to host the mcp
 * and authenticate itself, like it was talking to the remote mcp").
 *
 * The local MCP runs in the desktop's main process (electron/desktop/localMcp.js - mcp-server's core + localhost, on
 * 127.0.0.1). The login joins its room for the identity exactly as the web app joins the hosted one (lib room-client
 * connectRoom): the key derives the bucket key (okedge/bucket-key/v2, under the key's own site - "we still tell the key
 * what the rpid expects"), the room gives its challenge, the key signs the login proof over it (identity.proveLogin) and
 * the room checks it (the login proof required there). Two requests - what the login card learns and its budget pays.
 * Joined = the key was present at this login. The connection stays for the session (the local agents' room) and goes at
 * logout or with the key.
 */
import * as bucketLib from 'node-onlykey-lib/bucket';
import {invokeSync} from './desktop/specs/module';
import {shell} from './platform';
import {getOnlyKey} from './onlykey';
import {activeBackend} from './hooks/KeyContext';
import {challengeOpts} from './hostChallenge';

const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));
let room: any = null;

/* the local MCP's base URL - the desktop only, and only once it is up (null: not here, or it did not start) */
export function localMcpUrl(): string | null {
  return shell === 'desktop' ? invokeSync<string>('okedge:localMcp') : null;
}

/**
 * Log in to the local MCP: derive the bucket key, join with the login proof. -> false when there is no local MCP (the
 * caller proves the key its own way); throws when the key does not prove the identity or the room refuses it.
 */
export async function loginToLocalMcp(identity: string, onPress?: () => void): Promise<boolean> {
  const url = localMcpUrl();
  if (!url) return false;
  const app = await getOnlyKey(activeBackend());
  const held = await app.identity.load();
  if (held.id !== identity.toLowerCase()) throw new Error(`the key's identity is ${held.id.slice(0, 12)}, not ${identity.slice(0, 12)}`);
  /* 1. the bucket key - a derive under the key's own site (a press, or the login budget's derive) */
  const derive = challengeOpts("Making this login's bucket key");
  let bucketKey: {secretKey: Uint8Array; publicKey: Uint8Array};
  try {
    bucketKey = await bucketLib.bucketIdentity.deriveBucketKeyAt(app.okcrypto, held.publicKey, held.site, {
      confirm: (a: {digits?: number[]}) => { onPress?.(); derive.opts.confirm(a); },
      timeoutMs: 40000,
    });
  } finally {
    derive.done();
  }
  /* 2. the room's challenge, signed by the key as the login proof (a press, or the login budget's sign) - checked there */
  const prove = challengeOpts('Proving this key holds the identity');
  const device = await require('./serverRoom').thisDevice();
  try {
    leaveLocalMcp();
    room = await bucketLib.roomClient.connectRoom({
      url, device, WebSocket: (globalThis as any).WebSocket, randomBytes,
      /* no kept certificate: the join carries the login proof in its place (connectRoom's login) */
      me: {id: held.id, identityPublicKey: held.publicKey, bucketKey, certificate: new Uint8Array(0)},
      login: (asked: {host: string; nonce: Uint8Array}) => app.identity.proveLogin(asked, bucketKey.publicKey, {
        confirm: (a: {digits?: number[]}) => { onPress?.(); prove.opts.confirm(a); },
      }),
    });
  } finally {
    prove.done();
    bucketKey.secretKey.fill(0);
  }
  console.log(`[login] ${held.id.slice(0, 12)}: proven to the local MCP (${url}) - the key signed its challenge`);
  return true;
}

/* the local room left: at logout, at a lock, with the key */
export function leaveLocalMcp(): void {
  if (room) { try { room.close(); } catch { /* closed already */ } }
  room = null;
}

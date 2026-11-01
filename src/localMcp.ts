/*
 * THE DESKTOP'S LOCAL MCP (Brad, 2026-11-01: "the desktop checks itself over its local mcp"; "if it can connect, i want
 * to sync remote to local, authenticating with mcp instead of itself").
 *
 * The local MCP runs in the desktop's main process (electron/desktop/localMcp.js - mcp-server's core + localhost, on
 * 127.0.0.1). The login (serverRoom logIn) proves the key to the user's server first; only when that cannot be reached
 * does it join this one's room instead, with the same derive and the same login proof - the desktop checking itself.
 * The room joined then is kept here for the session (the local agents' room) and goes at logout or with the key.
 */
import {invokeSync} from './desktop/specs/module';
import {shell} from './platform';

let room: any = null;

/* the local MCP's base URL - the desktop only, and only once it is up (null: not here, or it did not start) */
export function localMcpUrl(): string | null {
  return shell === 'desktop' ? invokeSync<string>('okedge:localMcp') : null;
}

/* the room the login joined on the local MCP: kept until the logout or the key goes */
export function keepLocalRoom(r: any): void {
  leaveLocalMcp();
  room = r;
}

/* the local room left: at logout, at a lock, with the key */
export function leaveLocalMcp(): void {
  if (room) { try { room.close(); } catch { /* closed already */ } }
  room = null;
}

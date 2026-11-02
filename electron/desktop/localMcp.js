'use strict';

/**
 * THE DESKTOP'S LOCAL MCP (Brad, 2026-11-01: "the desktop app should be running a local mcp"; "so the desktop can re-use
 * the core and websocket to host the mcp and authenticate itself, like it was talking to the remote mcp"; "local only,
 * only need plain, no cert needed, we point the desktop app to localhost for the mcp").
 *
 * This computer's local MCP is node-onlykey-lib's (mcp/localhost/computer.js: the mcp-server Rectify app on
 * 127.0.0.1:8650, no proof asked, its record in ~/.onlykey-js) - the same `onlykey-js --service` hosts when this app is
 * not open. Here it runs in the main process while this app is the computer's member (member.js).
 *
 *   okedge:localMcp (sync)  -> the server's base URL (http://127.0.0.1:8650), or null while it is not up
 */
let server = null;
let starting = null;

async function start() {
  if (starting) return starting;
  starting = (async () => {
    /* the server's source is ESM (node-onlykey-lib mcp/package.json); the main process is CommonJS */
    const { startComputerMcp } = await import('node-onlykey-lib/mcp/computer');
    server = await startComputerMcp({ log: (l) => console.log(`[local-mcp] ${l}`) });
    console.log(`[local-mcp] ready on ${server.url}`);
  })().catch((e) => {
    /* the app runs without it (no local agents, no local self-auth) - said once, not hidden */
    console.log(`[local-mcp] did not start: ${e && e.message || e}`);
  });
  return starting;
}

async function stop() {
  if (starting) await starting;
  if (server) await server.close();
  server = null;
  starting = null;
}

module.exports = {
  /*
   * NOT STARTED WITH THE APP: it is this computer's local MCP only while this app is the computer's member
   * (electron/desktop/member.js - an `onlykey-js --service` that served steps down first, and gives 8650 back)
   */
  serve: start,
  stop,
  syncHandlers: {
    'okedge:localMcp': () => (server ? server.url : null),
  },
};

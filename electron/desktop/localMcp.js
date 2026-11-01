'use strict';

/**
 * THE DESKTOP'S LOCAL MCP (Brad, 2026-11-01: "the desktop app should be running a local mcp"; "so the desktop can re-use
 * the core and websocket to host the mcp and authenticate itself, like it was talking to the remote mcp"; "local only,
 * only need plain, no cert needed, we point the desktop app to localhost for the mcp").
 *
 * The mcp-server Rectify app (mcp-server/src: mcp-core + mcp-localhost) in this main process, on http:// and ws:// at
 * 127.0.0.1 - a free port, never another interface. The same routes and the same logic as the hosted one: /mcp for agents
 * on this machine, /ws/<identity> where this app joins - with no proof (below) - to hear their plans and answer them. It
 * keeps no sealed copy - the bucket stays in its file (hosting.js).
 *
 *   okedge:localMcp (sync)  -> the server's base URL (http://127.0.0.1:<port>), or null while it is not up
 */
let server = null;
let starting = null;

async function start() {
  if (starting) return starting;
  starting = (async () => {
    const Rectify = require('@bmatusiak/rectify');
    /* the server's source is ESM (mcp-server/src/package.json); the main process is CommonJS */
    const core = (await import('../../mcp-server/src/core/plugin.js')).default;
    const localhost = (await import('../../mcp-server/src/localhost/plugin.js')).default;
    const app = Rectify.build([core, localhost]);
    await app.start();
    /*
     * NO AUTH HERE (Brad, 2026-11-01: "the local mcp has no auth, but it still will communicate with the desktop app for
     * the planner and budget calls"): the login proves the key to the user's server, or the app checks it itself; this
     * room only carries this computer's agents to this app - any well-formed join for the identity enters (OPEN_JOIN).
     */
    server = await app.services.mcpLocalhost.start({ host: '127.0.0.1', port: 0, env: { REQUIRE_LOGIN: '0', OPEN_JOIN: '1' } });
    console.log(`[local-mcp] ready on ${server.url}`);
  })().catch((e) => {
    /* the app runs without it (no local agents, no local self-auth) - said once, not hidden */
    console.log(`[local-mcp] did not start: ${e && e.message || e}`);
  });
  return starting;
}

async function stop() {
  if (server) await server.close().catch(() => undefined);
  server = null;
}

module.exports = {
  start,
  stop,
  syncHandlers: {
    'okedge:localMcp': () => (server ? server.url : null),
  },
};

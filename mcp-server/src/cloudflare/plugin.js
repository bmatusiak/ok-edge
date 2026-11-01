/*
 * THE CLOUDFLARE SERVICE (a Rectify plugin - the mcp-server's runtime on Cloudflare; Brad, 2026-11-01: "cloudflare is for
 * cloudflare dependent running"): the Worker's routes. The rooms and sessions are Durable Objects (worker.js) around the
 * core's logic; this is only how a request reaches them.
 *   /mcp           the MCP face (mcpCore.handleMcp)
 *   /ws/<id>       a websocket into that identity's room (its Durable Object)
 *   anything else  the web app (docs/, the static build) - env.ASSETS
 */
export default function setup(imports, register) {
  const { mcpCore } = imports;
  register(null, {
    mcpCloudflare: {
      async fetch(request, env) {
        const url = new URL(request.url);
        if (url.pathname === '/mcp') return mcpCore.handleMcp(request, env);
        const m = mcpCore.ROOM_PATH.exec(url.pathname);
        if (!m) return env.ASSETS.fetch(request);
        if (request.headers.get('Upgrade') !== 'websocket') return new Response('a websocket only', { status: 426 });
        return env.ROOMS.get(env.ROOMS.idFromName(m[1])).fetch(request);
      },
    },
  });
}
setup.consumes = ['mcpCore'];
setup.provides = ['mcpCloudflare'];

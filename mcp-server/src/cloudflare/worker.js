/*
 * THE WORKER (wrangler.jsonc main): the mcp-server Rectify app on Cloudflare - mcp-core + mcp-cloudflare. Cloudflare binds
 * the Durable Object classes by their exported names, so they are here, each a thin shell: its ctx (storage, SQLite,
 * hibernating websockets, its alarm) handed to the core's logic, every call passed through. Nothing decided here.
 */
import { DurableObject } from 'cloudflare:workers';
import Rectify from '@bmatusiak/rectify';
/* the core is node-onlykey-lib's (mcp/core - S5c, 2026-11-02): the same server code the desktop and `onlykey-js --service` host */
import core from 'node-onlykey-lib/mcp/core';
import cloudflare from './plugin.js';

const app = Rectify.build([core, cloudflare]);
const services = app.start().then(() => app.services);

export default {
  async fetch(request, env) {
    return (await services).mcpCloudflare.fetch(request, env);
  },
};

export class IdentityRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    /* pings are answered by the runtime itself, without waking the room */
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"t":"ping"}', '{"t":"pong"}'));
    this.core = services.then((s) => new s.mcpCore.RoomCore(ctx, env));
  }

  /* one connection: a socket pair, the server end accepted by the room */
  async fetch(request) {
    const [client, server] = Object.values(new WebSocketPair());
    await (await this.core).accept(server, new URL(request.url));
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, data) { return (await this.core).webSocketMessage(ws, data); }
  async webSocketClose(ws) { return (await this.core).webSocketClose(ws); }
  async webSocketError(ws) { return (await this.core).webSocketError(ws); }
  async alarm() { return (await this.core).alarm(); }
  /* the agents' room side, as the MCP sessions call it (mcp.js ROOM_STUB) */
  async show(...a) { return (await this.core).show(...a); }
  async withdraw(...a) { return (await this.core).withdraw(...a); }
  async agentStatus(...a) { return (await this.core).agentStatus(...a); }
  async submit(...a) { return (await this.core).submit(...a); }
  async fill(...a) { return (await this.core).fill(...a); }
  async finish(...a) { return (await this.core).finish(...a); }
}

export class McpSession extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.core = services.then((s) => new s.mcpCore.McpSessionCore(ctx, env));
  }
  async open(...a) { return (await this.core).open(...a); }
  async known(...a) { return (await this.core).known(...a); }
  async end(...a) { return (await this.core).end(...a); }
  async call(...a) { return (await this.core).call(...a); }
}

export class AgentSession extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.core = services.then((s) => new s.mcpCore.AgentSessionCore(ctx, env));
  }
  async hello(...a) { return (await this.core).hello(...a); }
  async me(...a) { return (await this.core).me(...a); }
  async plan(...a) { return (await this.core).plan(...a); }
  async tool(...a) { return (await this.core).tool(...a); }
  async fromRoom(...a) { return (await this.core).fromRoom(...a); }
}

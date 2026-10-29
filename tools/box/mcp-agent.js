#!/usr/bin/env node
'use strict';
/*
 * mcp-agent.js - a TEST agent for the server's /mcp: the calls an AI agent makes, one per command, so a web app run
 * can be driven and watched (the Agents rows on the Edge tab) without an AI in the loop.
 *
 *   node tools/box/mcp-agent.js <url> hello [name]                 first time: the agent key is kept in the state file
 *   node tools/box/mcp-agent.js <url> <tool> '<json arguments>'    any tool: plan_new, plan_add, plan_submit, plan_wait, ...
 *   node tools/box/mcp-agent.js <url> tools                        the tool list
 *
 * State (MCP_AGENT_STATE, default /tmp/mcp-agent.json): the agent key and the session, so each command is the same
 * agent in the same session, as an AI's would be; a session the server forgot is started again (initialize + hello).
 * A dev server over HTTPS with the dev certificate: run with NODE_TLS_REJECT_UNAUTHORIZED=0 against loopback only.
 */
const fs = require('fs');

const [url, tool, rawArgs] = process.argv.slice(2);
const STATE = process.env.MCP_AGENT_STATE || '/tmp/mcp-agent.json';
if (!url || !tool) { console.error('mcp-agent.js <url> hello [name] | tools | <tool> \'<json arguments>\''); process.exit(2); }
const endpoint = `${url.replace(/\/$/, '')}/mcp`;
const load = () => { try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return {}; } };
const save = (s) => fs.writeFileSync(STATE, JSON.stringify(s, null, 2), { mode: 0o600 });

let n = 0;
async function post(body, sid) {
  const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...(sid ? { 'Mcp-Session-Id': sid } : {}) }, body: JSON.stringify(body) });
  return { status: r.status, sid: r.headers.get('Mcp-Session-Id'), body: r.status === 200 ? await r.json() : null };
}
async function initialize(s) {
  const r = await post({ jsonrpc: '2.0', id: ++n, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'mcp-agent.js', version: '1' } } });
  s.sid = r.sid;
  await post({ jsonrpc: '2.0', method: 'notifications/initialized' }, s.sid);
}
async function call(s, name, args) {
  let r = await post({ jsonrpc: '2.0', id: ++n, method: 'tools/call', params: { name, arguments: args } }, s.sid);
  if (r.status === 404 || !s.sid) {
    /* the server forgot the session: a new one, the same agent */
    await initialize(s);
    if (name !== 'hello' && s.agent_key) await post({ jsonrpc: '2.0', id: ++n, method: 'tools/call', params: { name: 'hello', arguments: { name: s.name || 'test agent', agent_key: s.agent_key } } }, s.sid);
    r = await post({ jsonrpc: '2.0', id: ++n, method: 'tools/call', params: { name, arguments: args } }, s.sid);
  }
  if (!r.body) throw new Error(`HTTP ${r.status}`);
  if (r.body.error) throw new Error(r.body.error.message);
  return r.body.result;
}

(async () => {
  const s = load();
  if (tool === 'tools') {
    if (!s.sid) await initialize(s);
    const r = await post({ jsonrpc: '2.0', id: ++n, method: 'tools/list' }, s.sid);
    console.log(r.body.result.tools.map((t) => t.name).join(' '));
    save(s);
    return;
  }
  const args = tool === 'hello' ? { name: rawArgs || s.name || 'test agent', ...(s.agent_key ? { agent_key: s.agent_key } : {}) } : JSON.parse(rawArgs || '{}');
  const result = await call(s, tool, args);
  if (tool === 'hello' && result.structuredContent) {
    s.name = args.name;
    if (result.structuredContent.agent_key) s.agent_key = result.structuredContent.agent_key;
    s.agent_id = result.structuredContent.agent_id;
  }
  save(s);
  /* the agent key is the agent's secret: never printed */
  const shown = { ...(result.structuredContent || {}) };
  if (shown.agent_key) shown.agent_key = '(kept in the state file)';
  console.log(result.isError ? `REFUSED: ${result.content[0].text}` : JSON.stringify(shown, null, 2));
})().catch((e) => { console.error(`mcp-agent: ${e.message}`); process.exit(1); });

#!/usr/bin/env node
'use strict';
/*
 * mcp-plan-agent.js - a TEST agent's whole side of an MCP plan (Step 4b), for a rehearsal beside it (rehearsals/
 * mcp-plan.yaml runs the owner's side): hello, a plan of one sign and one placeholder for the identity, submit (it waits,
 * asking again, until the owner has accepted it), the placeholder filled when the plan pauses for it, then the end and
 * every result. Each step through mcp-agent.js, as an AI's calls would be.
 *
 *   node tools/box/mcp-plan-agent.js <mcp url> <identity public key hex> [ssh identity]
 *
 * Exit 0 when the plan is done with both items signed; the signatures are printed (base64) beside the data they sign,
 * so they can be checked against the key's derived ssh key (onlykey-js agent <identity> --skey derived-v2).
 */
const { execFileSync } = require('child_process');
const path = require('path');

const [given, identity, ssh = 'ssh://test@example.com'] = process.argv.slice(2);
/* "desktop": the desktop app's local MCP on this machine, wherever it runs now (node-onlykey-lib desktop/trust.js record) */
const url = given === 'desktop' ? (require('node-onlykey-lib/desktop/trust').readLocalMcp(undefined, 'desktop') || {}).url : given;
if (!url || !/^[0-9a-f]{64}$/i.test(identity || '')) { console.error('mcp-plan-agent.js <mcp url | desktop> <identity public key hex> [ssh identity]  (desktop: no local MCP running here)'); process.exit(2); }
const AGENT = path.join(__dirname, 'mcp-agent.js');
/* its name (MCP_AGENT_NAME - a run's own, so the owner's flow accepts this agent and no other) and its own state file: a new agent each name */
const NAME = process.env.MCP_AGENT_NAME || 'mcp-plan-agent';
const env = { ...process.env, MCP_AGENT_STATE: process.env.MCP_AGENT_STATE || `/tmp/mcp-plan-agent-${NAME.replace(/[^\w-]/g, '_')}.json` };
const call = (tool, args) => {
  const out = execFileSync(process.execPath, [AGENT, url, tool, ...(args === undefined ? [] : [typeof args === 'string' ? args : JSON.stringify(args)])], { env, encoding: 'utf8' });
  if (out.startsWith('REFUSED: ')) return { refused: out.slice(9).trim() };
  return JSON.parse(out);
};
const say = (l) => console.log(`[agent] ${l}`);

const NOTES = `release notes ${new Date().toISOString()}`;
call('hello', NAME);
const { plan_id: id } = call('plan_new', { identity, title: 'Step 4b: sign the notes, then the tag' });
call('plan_add', { plan_id: id, op: 'sign', key: { kind: 'ssh', identity: ssh }, data: NOTES, reason: 'the release notes' });
call('plan_hold', { plan_id: id, op: 'sign', key: { kind: 'ssh', identity: ssh }, reason: 'the tag, once made' });
say(`plan ${id}: 1 sign + 1 placeholder for ${ssh}`);

/* submit: refused while the owner has not accepted this agent - each plan_show shows the owner the plan meanwhile */
for (let n = 0; ; n++) {
  const r = call('plan_submit', { plan_id: id });
  if (!r.refused) break;
  if (n === 0) say(`submit refused (${r.refused}) - waiting for the owner to accept this agent`);
  if (n > 60) { say('never accepted'); process.exit(1); }
  call('plan_wait', { plan_id: id, seconds: 5 });
}
say('submitted - the owner approves on the Edge sheet, one press');

let tag = null;
for (;;) {
  const w = call('plan_wait', { plan_id: id, seconds: 60 });
  if (w.state === 'paused' && w.waiting && w.waiting.includes(2) && !tag) {
    const first = w.results && w.results[1] && w.results[1].signature;
    tag = `tag v1 pins ${String(first).slice(0, 16)}`;
    call('plan_fill', { plan_id: id, item: 2, data: tag });
    say('paused for item 2 - filled');
    continue;
  }
  if (['done', 'ended', 'failed', 'declined'].includes(w.state)) {
    say(`plan ${id}: ${w.state}${w.why ? ` - ${w.why}` : ''}`);
    for (const [item, r] of Object.entries(w.results || {})) say(`  item ${item}: ${r.signature ? `signature ${r.signature}` : `refused - ${r.refusal}`}`);
    say(`  data 1: ${JSON.stringify(NOTES)}  data 2: ${JSON.stringify(tag)}`);
    say(`  receipts: ${(w.receipts || []).map((x) => `#${x.seq} ${x.code}`).join(', ')}`);
    process.exit(w.state === 'done' && Object.values(w.results || {}).filter((r) => r.signature).length === 2 ? 0 : 1);
  }
}

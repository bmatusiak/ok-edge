#!/usr/bin/env node
'use strict';
/*
 * mcp-plan-agent.js - a TEST agent's whole side of an MCP plan (Step 4b), for a rehearsal beside it (rehearsals/
 * mcp-plan.yaml runs the owner's side). Fingerprints first, data after (2026-11-04):
 *   1. hello; its card (card_new: the ssh identity it signs with) - asked once the owner has accepted it, then waited for
 *      (the owner approves the card sheet, the key certifies it at a press);
 *   2. a plan of two signs under that card, each item named by the SHA-256 of its data and no data; submitted;
 *   3. when the plan runs (its budget open), the data (plan_data); then the end, with every result.
 * Each step through mcp-agent.js, as an AI's calls would be.
 *
 *   node tools/box/mcp-plan-agent.js <mcp url> <identity public key hex> [ssh identity]
 *
 * Exit 0 when the plan is done with both items signed; the signatures are printed (base64) beside the data they sign,
 * so they can be checked against the key's derived ssh key (onlykey-js agent <identity> --skey derived-v2).
 */
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const path = require('path');

const [given, identity, ssh = 'ssh://test@example.com'] = process.argv.slice(2);
/* "computer": this computer's local MCP - the desktop app's or onlykey-js --service's (node-onlykey-lib desktop/trust.js record) */
const url = given === 'computer' ? (require('node-onlykey-lib/desktop/trust').readLocalMcp(undefined, 'computer') || {}).url : given;
if (!url || !/^[0-9a-f]{64}$/i.test(identity || '')) { console.error('mcp-plan-agent.js <mcp url | computer> <identity public key hex> [ssh identity]  (computer: no local MCP running here)'); process.exit(2); }
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
const fingerprint = (text) => crypto.createHash('sha256').update(text).digest('hex');
const ENDS = ['done', 'ended', 'failed', 'declined'];
const end = (id) => { for (;;) { const w = call('plan_wait', { plan_id: id, seconds: 60 }); if (ENDS.includes(w.state)) return w; } };

call('hello', NAME);

/* 1. the card: asked once the owner has accepted this agent (refused while pending) */
const CARD = `${NAME} card`;
let card;
for (let n = 0; ; n++) {
  card = call('card_new', { identity, label: CARD, ssh, reason: 'the dev loop\'s test plan' });
  if (!card.refused) break;
  if (n === 0) say(`card_new refused (${card.refused}) - waiting for the owner to accept this agent`);
  if (n > 60) { say('never accepted'); process.exit(1); }
  execFileSync(process.execPath, ['-e', 'setTimeout(() => {}, 5000)']);
}
say(`card "${CARD}" asked - the owner approves it, one press`);
const made = end(card.plan_id);
if (made.state !== 'done') { say(`card: ${made.state}${made.why ? ` - ${made.why}` : ''}`); process.exit(1); }
say(`card "${CARD}" certified`);

/* 2. the plan: fingerprints only */
const NOTES = `release notes ${new Date().toISOString()}`;
const TAG = `tag v1 for ${NOTES}`;
const key = { kind: 'ssh', identity: ssh };
const p = call('plan_new', { identity, title: 'Step 4b: sign the notes and the tag', card: CARD, items: [
  { op: 'sign', key, reason: 'the release notes', fingerprint: fingerprint(NOTES) },
  { op: 'sign', key, reason: 'the tag', fingerprint: fingerprint(TAG) },
] });
if (p.refused) { say(`plan_new refused: ${p.refused}`); process.exit(1); }
const r = call('plan_submit', { plan_id: p.plan_id });
if (r.refused) { say(`submit refused: ${r.refused}`); process.exit(1); }
say(`plan ${p.plan_id}: 2 signs for ${ssh}, fingerprints ${fingerprint(NOTES).slice(0, 12)} ${fingerprint(TAG).slice(0, 12)} - submitted, the owner approves on the Edge sheet, one press`);

/* 3. the data once it runs, then the end */
let w;
for (;;) {
  w = call('plan_wait', { plan_id: p.plan_id, seconds: 60 });
  if (w.state === 'running' && w.waiting.length) {
    const d = call('plan_data', { plan_id: p.plan_id, items: [{ item: 1, data: NOTES }, { item: 2, data: TAG }] });
    if (d.refused) { say(`plan_data refused: ${d.refused}`); process.exit(1); }
    say('running - the data sent');
    continue;
  }
  if (ENDS.includes(w.state)) break;
}
say(`plan ${p.plan_id}: ${w.state}${w.why ? ` - ${w.why}` : ''}`);
for (const [item, x] of Object.entries(w.results || {})) say(`  item ${item}: ${x.signature ? `signature ${x.signature}` : `refused - ${x.refusal}`}`);
say(`  data 1: ${JSON.stringify(NOTES)}  data 2: ${JSON.stringify(TAG)}`);
say(`  receipts: ${(w.receipts || []).map((x) => `#${x.seq} ${x.code}`).join(', ')}`);
process.exit(w.state === 'done' && Object.values(w.results || {}).filter((x) => x.signature).length === 2 ? 0 : 1);

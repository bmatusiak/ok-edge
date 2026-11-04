/*
 * THE AGENTS, ON THIS DEVICE (the MCP plan, Step 4; Brad, 2026-10-28: "the user puts a key into the web app, and the AI
 * agent uses the MCP for its session. The user can see everything that will and has happened, with approvals in
 * between").
 *
 * An AI agent given the server's URL and this identity's public key builds a sign/decrypt plan on the server's /mcp
 * (node-onlykey-lib mcp/core/mcp.js). Every change reaches this identity's room at once; this device, joined there (serverRoom.ts),
 * hears it through the lib's room client (bucket/src/room-client.js `on('mcp')`) and keeps the picture here:
 *   - the agents that asked: pending until the owner accepts them, accepted, or blocked - the owner's word, written in
 *     the room by the identity's own devices only (an agent can never accept itself);
 *   - their plans, as they grow, until they are submitted, run and done.
 * The Edge tab draws it (screens/EdgeScreen.tsx, the Agents rows); running a submitted plan - the Edge sheet, one
 * budget, one press - listens here too (onPlanEvent).
 *
 * Not sealed end to end (decided 2026-10-28): the server relays plans over TLS. What it never does is approve: only a
 * person at a device of the identity accepts an agent or approves a plan, and only the key's press opens a budget.
 */

import {ioPulse} from './btActivity';

export type AgentState = 'pending' | 'accepted' | 'blocked';
export type Agent = {id: string; name: string; state: AgentState; first?: number; last?: number};
export type PlanItem = {
  item: number;
  op: 'sign' | 'decrypt';
  /* ssh / gpg: an agent-derived key by its label; rsa: a stored slot and its size */
  key: {kind: 'ssh' | 'gpg'; identity: string} | {kind: 'rsa'; slot: number; bits: number};
  reason: string;
  /* the SHA-256 of the data it will sign: the data itself comes once the budget is open (plan_data), never kept here */
  fingerprint: string;
};
export type PlanResult = {item?: number; signature?: string; plaintext?: string; refusal?: string; encoding?: string};
export type PlanState = 'draft' | 'submitted' | 'running' | 'done' | 'declined' | 'failed' | 'ended';
/* an agent's card request (mcp.js card_new): run as a plan of kind 'card' - the card sheet, a press, no budget */
export type CardAsk = {label: string; slots: number[]; ssh?: string; days: number; reason: string};
export type Plan = {
  id: string;
  kind?: 'plan' | 'card';
  title: string;
  /* the agent's card the plan's budget is asked under (a plan), or what the agent asks for (a card) */
  card?: string;
  ask?: CardAsk;
  agent: {id: string; name: string};
  state: PlanState;
  items: PlanItem[];
  results: Record<string, PlanResult>;
  receipts: {seq: number; code: string}[];
  why: string | null;
  /* the device that runs it, once one claimed it (its owner tapped Approve there - mcp-server room.js plan-claim) */
  by?: string;
};
/* identityPublicKey: what the owner gives an agent (with the /mcp address) - the hex of the bucket identity's public key */
export type AgentsState = {online: boolean; identityPublicKey: string | null; agents: Agent[]; plans: Plan[]};
/* what a running plan listens for: the owner's room says it was submitted, an item's data came, or finish */
export type PlanEvent =
  | {ev: 'submit'; plan: Plan}
  | {ev: 'data'; plan: string; item: number; data: string; encoding?: string}
  | {ev: 'finish'; plan: string};

let state: AgentsState = {online: false, identityPublicKey: null, agents: [], plans: []};
const listeners = new Set<(s: AgentsState) => void>();
const planListeners = new Set<(e: PlanEvent) => void>();

/*
 * TWO ROOMS ON THE DESKTOP (Brad, 2026-11-01: "the local mcp has no auth, but it still will communicate with the desktop
 * app for the planner and budget calls"): the user's server's room (its agents anywhere) and the local MCP's (agents on
 * this computer). Each room's agents and plans are kept apart; the picture is all of them, and an answer goes back to
 * the room that holds its agent or plan. Elsewhere there is one room, the server's - and on the phone, a computer's room
 * over Bluetooth too (bleRoom.ts: its mcp-server's agents, ok-edge plan B3).
 */
export type RoomWhere = 'server' | 'local' | 'ble';
type Held = {where: RoomWhere; agents: Agent[]; plans: Plan[]};
const rooms = new Map<any, Held>();

const set = (patch: Partial<AgentsState>) => {
  state = {...state, ...patch};
  for (const l of [...listeners]) l(state);
};
/* the picture again from every room's own lists */
const show = () => {
  const all = [...rooms.values()];
  set({
    online: rooms.size > 0,
    agents: all.flatMap(h => h.agents).sort((x, y) => (x.first ?? 0) - (y.first ?? 0)),
    plans: all.flatMap(h => h.plans),
  });
};
export const agentsState = () => state;
export function onAgents(l: (s: AgentsState) => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
export function onPlanEvent(l: (e: PlanEvent) => void): () => void {
  planListeners.add(l);
  return () => { planListeners.delete(l); };
}

/* what a room tells every device of the identity (node-onlykey-lib mcp/core/room.js `tell`), into that room's lists */
function heard(h: Held, m: any): void {
  const upsertPlan = (p: Plan) => { h.plans = [...h.plans.filter(x => x.id !== p.id), p]; };
  switch (m && m.ev) {
    case 'agent': {
      const others = h.agents.filter(x => x.id !== m.agent.id);
      h.agents = m.agent.state === 'removed' ? others : [...others, m.agent as Agent];
      if (m.agent.state === 'blocked' || m.agent.state === 'removed') h.plans = h.plans.filter(p => p.agent.id !== m.agent.id || p.state === 'running');
      break;
    }
    case 'plan':
      upsertPlan(m.plan);
      break;
    case 'plan-gone':
      h.plans = h.plans.filter(p => p.id !== m.plan);
      break;
    case 'submit':
      upsertPlan(m.plan);
      show();
      for (const l of [...planListeners]) l({ev: 'submit', plan: m.plan});
      return;
    /* an item's data: to the plan's runner only - the picture keeps the fingerprints, never the data */
    case 'data':
      for (const l of [...planListeners]) l({ev: 'data', plan: m.plan, item: m.item, data: m.data, encoding: m.encoding});
      return;
    case 'finish':
      for (const l of [...planListeners]) l({ev: 'finish', plan: m.plan});
      return;
    default:
      return;
  }
  show();
}

/** A room was joined (serverRoom.ts the server's, localMcp.ts this computer's): follow its agents, read what it holds. */
export function attachAgents(r: any, identityPublicKey: string, where: RoomWhere = 'server'): void {
  /* the submitted plans this device may run (mcpPlans.ts) - listened for once, from the first room with agents */
  require('./mcpPlans').startMcpPlans();
  for (const [x, h] of [...rooms]) if (h.where === where) rooms.delete(x);
  const h: Held = {where, agents: [], plans: []};
  rooms.set(r, h);
  set({identityPublicKey});
  show();
  r.on('mcp', (m: any) => { if (rooms.get(r) === h) { ioPulse('mcp'); heard(h, m); } });
  r.on('close', () => { if (rooms.get(r) === h) { rooms.delete(r); show(); } });
  void r.agents().then(
    (x: {agents: Agent[]; plans: Plan[]}) => { if (rooms.get(r) === h) { h.agents = x.agents; h.plans = x.plans; show(); } },
    (e: Error) => console.log(`[agents] the ${where} room's list did not come: ${e.message}`),
  );
}

/** A room was left (the bucket closed, another server; no `where`: every room): nothing shown that it alone could answer. */
export function detachAgents(where?: RoomWhere): void {
  for (const [x, h] of [...rooms]) if (!where || h.where === where) rooms.delete(x);
  if (!rooms.size) set({identityPublicKey: null});
  show();
}

/* the room that holds this agent or plan - the one its answer goes to */
const need = (id: string, kind: 'agent' | 'plan') => {
  for (const [r, h] of rooms) if (kind === 'agent' ? h.agents.some(a => a.id === id) : h.plans.some(p => p.id === id)) return r;
  throw new Error(`no room here holds that ${kind} - the server is not reachable from here now`);
};
/** The owner's word on an agent (the room broadcasts it to every device of the identity). */
export async function setAgent(id: string, s: 'accepted' | 'blocked' | 'removed'): Promise<void> {
  await need(id, 'agent').setAgent(id, s);
}
/** This device runs the plan (its owner tapped Approve here): refused when another device of the identity claimed it first. */
export async function planClaim(id: string): Promise<void> {
  await need(id, 'plan').planClaim(id);
}
/** This device's id in the room that holds the plan - what the plan's `by` names when this device claimed it. */
export function youIn(id: string): string | null {
  try { return need(id, 'plan').you ?? null; } catch { return null; }
}
/** A plan's progress, back to its agent (plan_wait): its state, results by item, receipts. */
export async function planUpdate(id: string, u: {state?: PlanState; results?: PlanResult[]; receipts?: {seq: number; code: string}[]; why?: string}): Promise<void> {
  await need(id, 'plan').planUpdate(id, u);
}

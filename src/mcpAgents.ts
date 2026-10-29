/*
 * THE AGENTS, ON THIS DEVICE (the MCP plan, Step 4; Brad, 2026-10-28: "the user puts a key into the web app, and the AI
 * agent uses the MCP for its session. The user can see everything that will and has happened, with approvals in
 * between").
 *
 * An AI agent given the server's URL and this identity's public key builds a sign/decrypt plan on the server's /mcp
 * (mcp-server/src/mcp.js). Every change reaches this identity's room at once; this device, joined there (serverRoom.ts),
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

export type AgentState = 'pending' | 'accepted' | 'blocked';
export type Agent = {id: string; name: string; state: AgentState; first?: number; last?: number};
export type PlanItem = {
  item: number;
  op: 'sign' | 'decrypt';
  key: {kind: 'ssh' | 'gpg'; identity: string};
  reason: string;
  /* the data to sign or decrypt (text, or base64 with encoding), or null for a placeholder still waiting for it */
  data: string | null;
  encoding?: 'text' | 'base64';
  held?: boolean;
};
export type PlanResult = {item?: number; signature?: string; plaintext?: string; refusal?: string; encoding?: string};
export type PlanState = 'draft' | 'submitted' | 'running' | 'paused' | 'done' | 'declined' | 'failed' | 'ended';
export type Plan = {
  id: string;
  title: string;
  agent: {id: string; name: string};
  state: PlanState;
  items: PlanItem[];
  results: Record<string, PlanResult>;
  receipts: {seq: number; code: string}[];
  why: string | null;
};
/* identityPublicKey: what the owner gives an agent (with the /mcp address) - the hex of the bucket identity's public key */
export type AgentsState = {online: boolean; identityPublicKey: string | null; agents: Agent[]; plans: Plan[]};
/* what a running plan listens for: the owner's room says it was submitted, a placeholder was filled, or finish */
export type PlanEvent =
  | {ev: 'submit'; plan: Plan}
  | {ev: 'fill'; plan: string; item: number; data: string; encoding?: string}
  | {ev: 'finish'; plan: string};

let state: AgentsState = {online: false, identityPublicKey: null, agents: [], plans: []};
const listeners = new Set<(s: AgentsState) => void>();
const planListeners = new Set<(e: PlanEvent) => void>();
let room: any = null;

const set = (patch: Partial<AgentsState>) => {
  state = {...state, ...patch};
  for (const l of [...listeners]) l(state);
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

const upsertAgent = (a: Omit<Agent, 'state'> & {state: AgentState | 'removed'}) => {
  const others = state.agents.filter(x => x.id !== a.id);
  set({agents: a.state === 'removed' ? others : [...others, a as Agent].sort((x, y) => (x.first ?? 0) - (y.first ?? 0))});
};
const upsertPlan = (p: Plan) => set({plans: [...state.plans.filter(x => x.id !== p.id), p]});

/* what the room tells every device of the identity (mcp-server/src/index.js `tell`) */
function heard(m: any): void {
  switch (m && m.ev) {
    case 'agent':
      upsertAgent(m.agent);
      if (m.agent.state === 'blocked' || m.agent.state === 'removed') set({plans: state.plans.filter(p => p.agent.id !== m.agent.id || p.state === 'running' || p.state === 'paused')});
      return;
    case 'plan':
      upsertPlan(m.plan);
      return;
    case 'plan-gone':
      set({plans: state.plans.filter(p => p.id !== m.plan)});
      return;
    case 'submit':
      upsertPlan(m.plan);
      for (const l of [...planListeners]) l({ev: 'submit', plan: m.plan});
      return;
    case 'fill': {
      const p = state.plans.find(x => x.id === m.plan);
      if (p) upsertPlan({...p, items: p.items.map(it => (it.item === m.item ? {...it, data: m.data, encoding: m.encoding} : it))});
      for (const l of [...planListeners]) l({ev: 'fill', plan: m.plan, item: m.item, data: m.data, encoding: m.encoding});
      return;
    }
    case 'finish':
      for (const l of [...planListeners]) l({ev: 'finish', plan: m.plan});
      return;
    default:
  }
}

/** The room was joined (serverRoom.ts): follow its agents, and read what it already holds. */
export function attachAgents(r: any, identityPublicKey: string): void {
  room = r;
  set({online: true, identityPublicKey});
  r.on('mcp', (m: any) => { if (room === r) heard(m); });
  r.on('close', () => { if (room === r) { room = null; set({online: false}); } });
  void r.agents().then(
    (x: {agents: Agent[]; plans: Plan[]}) => { if (room === r) set({agents: x.agents, plans: x.plans}); },
    (e: Error) => console.log(`[agents] the room's list did not come: ${e.message}`),
  );
}

/** The room was left (the bucket closed, another server): nothing is shown that this device cannot answer. */
export function detachAgents(): void {
  room = null;
  set({online: false, identityPublicKey: null, agents: [], plans: []});
}

const need = () => {
  if (!room) throw new Error('not in the room - the server is not reachable from here now');
  return room;
};
/** The owner's word on an agent (the room broadcasts it to every device of the identity). */
export async function setAgent(id: string, s: 'accepted' | 'blocked' | 'removed'): Promise<void> {
  await need().setAgent(id, s);
}
/** A plan's progress, back to its agent (plan_wait): its state, results by item, receipts. */
export async function planUpdate(id: string, u: {state?: PlanState; results?: PlanResult[]; receipts?: {seq: number; code: string}[]; why?: string}): Promise<void> {
  await need().planUpdate(id, u);
}

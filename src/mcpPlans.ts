/*
 * THE MCP PLANS THIS DEVICE RUNS (the MCP plan, Step 4b: "Approve on the Edge sheet -> one budget, one press -> signs,
 * results to plan_wait, receipts, end"). An agent built a plan on the server's /mcp and submitted it; the room told every
 * device of the identity (mcpAgents.ts onPlanEvent). Here each device runs it as an AGENT OF ITS OWN HOST: the lib's plan
 * runner (node-onlykey-lib edge/src/plan.js) asks one budget sized to the plan through the lib's budget client, whose
 * channel is this device's Edge host (edgeAgents.handleEdgeMessage) - the same sheet, copy check (R27) and press as a
 * computer's request, named for the agent that built the plan. Then each item is one paid use and its receipt, its result
 * goes back to the room (plan_wait), and the budget ends.
 *
 * ONE DEVICE RUNS IT (mcp-server room.js plan-claim): every device shows the sheet; the first whose owner taps Approve
 * claims the plan before the press, and the others' sheets go when they hear the claim (withdrawSheet). Nothing runs on
 * a device where nobody tapped Approve.
 *
 * KEY REQUESTS: the plan runner's count (plan.js) - the host's copy check + grant + ONE press, the opening read back,
 * four per item, one to end. None on a timer.
 */
import {client as clientLib, plan as planLib} from 'node-onlykey-lib/edge';
import {onAgents, onPlanEvent, planClaim, planUpdate, youIn, type Plan, type PlanEvent} from './mcpAgents';
import {AGENT_FROM, handleEdgeMessage, withdrawSheet} from './edgeAgents';
import {getOnlyKey} from './onlykey';
import {activeBackend} from './hooks/KeyContext';
import {loadIdentity} from './edgeIdentity';
import {openpgpFork} from './pgpOps';

/* the plans running here, each with what its runner listens to (its fills and finish) */
const running = new Map<string, Set<(e: PlanEvent) => void>>();
/* plans whose sheet here was taken down because another device claimed or declined them: nothing told for them */
const withdrawn = new Set<string>();
let started = false;

/** Listen for submitted plans - once, when a room with agents is first attached (mcpAgents.attachAgents). */
export function startMcpPlans(): void {
  if (started) return;
  started = true;
  onPlanEvent(e => {
    if (e.ev === 'submit') { void runOne(e.plan); return; }
    for (const l of [...(running.get(e.plan) ?? [])]) l(e);
  });
  /* another device claimed a plan whose sheet is up here, or the owner declined it there: the sheet goes */
  onAgents(s => {
    for (const p of s.plans) {
      if (!running.has(p.id) || withdrawn.has(p.id)) continue;
      const elsewhere = p.by ? p.by !== youIn(p.id) : p.state !== 'submitted';
      if (elsewhere) { withdrawn.add(p.id); withdrawSheet(p.id); }
    }
  });
}

async function runOne(plan: Plan): Promise<void> {
  if (running.has(plan.id)) return;
  const listeners = new Set<(e: PlanEvent) => void>();
  running.set(plan.id, listeners);
  const say = (line: string) => console.log(`[mcp plan] ${line}`);
  say(`${plan.id}: "${plan.title}" from ${plan.agent.name} - ${plan.items.length} item(s), waiting for your approval`);
  try {
    const app = await getOnlyKey(activeBackend());
    /* the sheet names the agent that built the plan, as a computer's request names that computer */
    const from = `${AGENT_FROM}${plan.agent.id}|${plan.agent.name}`;
    let claimed = false;
    const channel = {
      send: (msg: any) => handleEdgeMessage(msg, from, {
        plan: plan.id,
        onApprove: async () => {
          try {
            await planClaim(plan.id);
            claimed = true;
            return null;
          } catch (e) {
            withdrawn.add(plan.id);
            return `another of your devices runs it (${String((e as Error)?.message ?? e)})`;
          }
        },
      }),
    };
    const end = await planLib.runPlan({
      plan,
      client: clientLib.createEdgeClient({edge: app.edge, channel}),
      signers: planLib.planSigners({okcrypto: app.okcrypto, openpgp: openpgpFork(), identity: () => loadIdentity()}),
      /*
       * Only the device that claimed it tells the room how it runs. Unclaimed, only the owner's Decline is told (the
       * person said no - every device's sheet goes); a sheet that timed out here or was withdrawn says nothing, since
       * another device may still approve it.
       */
      update: async (u: any) => {
        if (withdrawn.has(plan.id)) return;
        if (!claimed && u.state !== 'declined') return;
        await planUpdate(plan.id, u);
      },
      subscribe: (l: (e: any) => void) => {
        listeners.add(l);
        return () => { listeners.delete(l); };
      },
      log: say,
    });
    say(`${plan.id}: ${end}${claimed ? '' : ' (not run here)'}`);
  } catch (e) {
    say(`${plan.id}: not run - ${String((e as Error)?.message ?? e)}`);
  } finally {
    running.delete(plan.id);
    withdrawn.delete(plan.id);
  }
}

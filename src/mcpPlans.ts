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
 * FINGERPRINTS FIRST (Brad, 2026-11-04): the sheet shows each item's fingerprint; the data comes after Approve (plan_data
 * -> the room's 'data' events, passed to the runner here and kept nowhere else), and the runner checks it before the key
 * signs. A CARD REQUEST (mcp.js card_new, a plan of kind 'card') is the agent asking for the card its plans go under: the
 * card sheet (its label, keys and who asks), the claim at Approve as a plan's, one press to certify - bound to the agent.
 *
 * KEY REQUESTS: the plan runner's count (plan.js) - the host's copy check + grant + ONE press, the opening read back,
 * four per item, one to end; after each receipt and at the end, the Edge copy follows (followCopy, below: the key's
 * head and the new links). A card: its certify press. None on a timer.
 */
import {agents as agentsLib, client as clientLib, plan as planLib} from 'node-onlykey-lib/edge';
import {onAgents, onPlanEvent, planClaim, planUpdate, youIn, type Plan, type PlanEvent} from './mcpAgents';
import {AGENT_FROM, handleEdgeMessage, withdrawSheet} from './edgeAgents';
import {getOnlyKey} from './onlykey';
import {activeBackend} from './hooks/KeyContext';
import {loadIdentity} from './edgeIdentity';
import {openpgpFork} from './pgpOps';
import {keyTask} from './keyBusy';
import {certKeyStillIn, certLine, keepCert, slotOfCert, slotOfCertHash, type CertKey} from './certKeys';
import {SoftKeyEdge} from './edgeSoftKey';
import {chainState} from './edgeStore';

/* the plans running here, each with what its runner listens to (its fills and finish) */
const running = new Map<string, Set<(e: PlanEvent) => void>>();
/* plans whose sheet here was taken down because another device claimed or declined them: nothing told for them */
const withdrawn = new Set<string>();
let started = false;

/*
 * THE EDGE COPY FOLLOWS A PLAN (Brad, 2026-11-05: after the release APK's two signs the Edge tab's budget card and the
 * progress card on the sheet both still read "0 of 2 uses spent, Active"). A computer's uses reach the copy when it lets
 * the key go (its log, useEdge onKeyFree); a plan runs HERE, straight on the key, so nothing told the copy. After each
 * receipt and at the end (plan.js progress) one copy check reads the key's head and the links since - the sheet's card
 * redraws on it (chainState 'checked') and the Edge tab looks again (onPlanMoved). One at a time: a check asked while
 * one runs is folded into the next.
 */
const movedListeners = new Set<() => void>();
export function onPlanMoved(listener: () => void): () => void {
  movedListeners.add(listener);
  return () => { movedListeners.delete(listener); };
}
let following: Promise<void> | null = null;
let followAgain = false;
function followCopy(): Promise<void> {
  if (following) { followAgain = true; return following; }
  following = (async () => {
    do {
      followAgain = false;
      const source = await SoftKeyEdge.open();
      if (source) await chainState.validity(source);
    } while (followAgain);
    for (const l of [...movedListeners]) l();
  })().finally(() => { following = null; });
  return following;
}

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
  if (plan.kind === 'card') return runCard(plan);
  /* one tag for this file's lines and the lib runner's (which start "plan <id>:") */
  const say = (line: string) => console.log(`[mcp] ${line}`);
  say(`plan ${plan.id}: "${plan.title}" from ${plan.agent.name} - ${plan.items.length} item(s), waiting for your approval`);
  try {
    /*
     * AN RSA ITEM NAMES ITS KEY BY ITS CERTIFICATE (key.cert, its SHA-256 - mcp.js): the slot comes from the owner's Key
     * Chain, where approving the card kept the certificate. Not kept here: this device does not run it (another of the
     * owner's devices may), and says why only in its own log - the agent never sees a slot.
     */
    for (const it of plan.items) {
      if (it.key?.kind !== 'rsa') continue;
      const k = it.key.cert ? await slotOfCertHash(it.key.cert) : null;
      if (!k) { say(`plan ${plan.id}: not run here - item ${it.item}'s certificate ${String(it.key.cert || '').slice(0, 16)}… is in no Key Chain entry of this device`); return; }
      /*
       * THE KEPT CERTIFICATE IS THE REFERENCE, SO THE SLOT IS CHECKED AGAINST IT EACH TIME (Brad, 2026-11-05: "this forces
       * the user to keep a backup of their pubkey to ensure the correct pubkey they have listed gets properly used"): the
       * slot's public key read now (no press) must be the certificate's. Another key there - replaced since the
       * certificate was kept - and nothing is signed; the agent hears only that the certificate's key is not here.
       */
      if (!(await certKeyStillIn(k))) {
        const why = `the key of certificate ${k.sha256.slice(0, 16)}… is not on this OnlyKey`;
        say(`plan ${plan.id}: refused - RSA${k.slot} no longer holds the key of the kept certificate ${k.sha256.slice(0, 16)}… (re-import it, or put the key back)`);
        await planUpdate(plan.id, {state: 'failed', why}).catch(() => {});
        return;
      }
      it.key = {...it.key, slot: k.slot, bits: k.bits};
    }
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
    /*
     * THE PLAN'S OWN KEY WORK SAYS WHOSE IT IS (box, 2026-11-04: the budget client's first reads showed "Working with
     * your key" with no reason): a weak task - its reads, signs and receipts are said as the agent's plan, and any other
     * named work keeps its own name
     */
    const end = await keyTask(`${plan.agent.name}'s plan "${plan.title}"`, () => planLib.runPlan({
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
      progress: followCopy,
    }), {weak: true});
    if (!claimed) say(`plan ${plan.id}: ${end} - not run here`);
  } catch (e) {
    say(`plan ${plan.id}: not run - ${String((e as Error)?.message ?? e)}`);
  } finally {
    running.delete(plan.id);
    withdrawn.delete(plan.id);
  }
}

/*
 * THE AGENT'S CARD, ASKED (mcp.js card_new): the lib's card CREATE through this device's host, as a computer's - the card
 * sheet, the claim at Approve, the certify press - from the agent (edgeAgents computerOf "agent:<id>"), so the host binds
 * the card to it. Only the claiming device tells the room the end; a Decline here is told as a plan's.
 */
async function runCard(plan: Plan): Promise<void> {
  const say = (line: string) => console.log(`[mcp] ${line}`);
  const ask = plan.ask;
  let claimed = false;
  const told = async (u: any) => {
    if (withdrawn.has(plan.id) || (!claimed && u.state !== 'declined')) return;
    await planUpdate(plan.id, u).catch((e: unknown) => say(`plan ${plan.id}: its update was not taken (${String((e as Error)?.message ?? e)})`));
  };
  try {
    if (!ask) { await told({state: 'failed', why: 'a card request names no card'}); return; }
    say(`plan ${plan.id}: ${plan.agent.name} asks for the agent card "${ask.label}" - waiting for your approval`);
    /*
     * ITS RSA KEYS BY THEIR CERTIFICATES (Brad, 2026-11-04: "protect the actual slot ids from the random ai agent - it's
     * only asking for the cert it's presenting"): each certificate turned into the slot whose key it certifies, here, on
     * the owner's device (certKeys.ts). The card sheet shows the certificate and that slot to the owner; nothing told back
     * to the agent names a slot. A certificate for no key of this OnlyKey is refused before any sheet.
     */
    const keys: CertKey[] = [];
    for (const c of ask.certs || []) {
      try {
        keys.push(await slotOfCert(c.pem));
      } catch (e) {
        say(`plan ${plan.id}: the card "${ask.label}" - ${String((e as Error)?.message ?? e)}`);
        return void (await planUpdate(plan.id, {state: 'failed', why: String((e as Error)?.message ?? e)}).catch(() => {}));
      }
    }
    const info = {
      label: ask.label, created: Math.floor(Date.now() / 1000), expires: ask.days * 86400,
      derive: ask.ssh ? {ssh: ask.ssh} : {}, slots: [...new Set(keys.map(k => k.slot))].sort(), committer: null,
    };
    const r: any = await handleEdgeMessage(agentsLib.buildCreate({info}), `${AGENT_FROM}${plan.agent.id}|${plan.agent.name}`, {
      plan: plan.id,
      keys: keys.map(certLine),
      /* what the agent says it is for - the sheet's "for" line ("use ... for signing ok-edge") */
      reason: ask.reason,
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
    });
    const state = r?.ok ? 'done' : r?.refusal === 'declined' ? 'declined' : 'failed';
    say(`plan ${plan.id}: the card "${ask.label}" - ${state}${r?.detail ? ` (${r.detail})` : ''}`);
    /* approved: each certificate kept on its slot's Key Chain entry - in the bucket, for the plans' lookup and for recovery */
    if (r?.ok) {
      for (const k of keys) {
        const kept = await keepCert(k).catch((e: unknown) => `not kept (${String((e as Error)?.message ?? e)})`);
        say(`plan ${plan.id}: the certificate ${k.sha256.slice(0, 16)}… in the Key Chain: ${kept}`);
      }
    }
    await told({state, why: r?.ok ? '' : r?.refusal === 'declined' ? 'the owner declined it' : String(r?.detail ?? r?.refusal ?? 'no answer')});
  } catch (e) {
    say(`plan ${plan.id}: not run - ${String((e as Error)?.message ?? e)}`);
  } finally {
    running.delete(plan.id);
    withdrawn.delete(plan.id);
  }
}

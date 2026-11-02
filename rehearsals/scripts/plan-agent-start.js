/*
 * THE TEST AGENT STARTS BESIDE THE FLOW (the air-gapped dev loop): the identity public key the Edge tab gives an agent
 * ("Give an AI agent these two"), then tools/box/mcp-plan-agent.js on the app's own machine against its desktop's local
 * MCP (the drive's plan-agent action) - not awaited here: the flow goes on to accept it and approve its plan, and
 * plan-agent-end.js takes its verdict.
 */
const identity = (drive.app.text.match(/\b[0-9a-f]{64}\b/) || [])[0];
if (!identity) throw new Error('the Edge tab shows no identity public key - is a bucket open and the Agents rows on screen?');
/* a name of this run's own: the flow accepts this agent, never another room's (mcp-plan.yaml "Accept ${output.agentName}") */
output.agentName = `dev-loop-${Date.now().toString(36)}`;
drive.say(`the agent ${output.agentName}'s plan for identity ${identity.slice(0, 12)}…`);
output.__planAgent = drive.machine('plan-agent', drive.app.shell, { identity, name: output.agentName }).catch((e) => ({ ok: false, why: e.message }));

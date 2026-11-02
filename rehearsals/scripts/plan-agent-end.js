/* the test agent's own verdict (plan-agent-start.js): its plan done, both items signed - its last lines said */
const r = output.__planAgent ? await output.__planAgent : { ok: false, why: 'no agent was started (plan-agent-start.js)' };
output.__planAgent = null;
if (!r.ok) throw new Error(`the agent: ${r.why}`);
drive.say(`the agent: ${r.what}`);

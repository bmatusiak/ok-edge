/* the setup's own verdict (setup-start.js): the identity kept - its last lines */
const r = output.__setup ? await output.__setup : { ok: false, why: 'no setup was started (setup-start.js)' };
output.__setup = null;
if (!r.ok) throw new Error(`the setup: ${r.why}`);
drive.say(`the setup: ${r.what.split('\n').join(' | ')}`);

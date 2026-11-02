/*
 * the ship's own verdict (ship-start.js): exit 0 - the ship exits 0 only after DONE or "nothing to do", and nothing to
 * do is a failed proof here. Its last lines are the timing table; the whole output is in drive-logs/cmds/.
 */
const r = output.__ship ? await output.__ship : { ok: false, why: 'no ship was started (ship-start.js)' };
output.__ship = null;
if (!r.ok) throw new Error(`the ship: ${r.why}`);
if (/nothing to do/.test(r.what)) throw new Error('the ship found nothing to do - the scratch repo has no unsigned commit');
drive.say('the ship: done (its output: drive-logs/cmds/)');

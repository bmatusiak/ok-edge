/* the ship's own verdict (ship-start.js): DONE, its signature and push said - its last lines */
const r = output.__ship ? await output.__ship : { ok: false, why: 'no ship was started (ship-start.js)' };
output.__ship = null;
if (!r.ok) throw new Error(`the ship: ${r.why}`);
if (!/\bDONE\b/.test(r.what)) throw new Error(`the ship ended without DONE: ${r.what}`);
drive.say(`the ship: ${r.what.split('\n').join(' | ')}`);

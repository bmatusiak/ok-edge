/*
 * the card's own verdict (card-start.js): edge setup exits 0 only when the host made the card (or this computer already
 * has that one) - its rows are printed with the certificate; anything else names why. The whole output is in
 * drive-logs/cmds/.
 */
const r = output.__card ? await output.__card : { ok: false, why: 'no card was asked for (card-start.js)' };
output.__card = null;
if (!r.ok) throw new Error(`the card: ${r.why}`);
drive.say('the card: made and kept (its output: drive-logs/cmds/)');

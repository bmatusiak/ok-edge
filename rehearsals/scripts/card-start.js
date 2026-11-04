/*
 * THE CARD IS ASKED FOR BESIDE THE FLOW (card.yaml): `onlykey-js edge --test-mode setup --label <LABEL>` on the app's own
 * machine (the drive's cli action, its output live in the drive window's cli tab) - not awaited here: the flow goes on to
 * approve the card on this app's sheet, and card-end.js takes its verdict.
 */
/*
 * A NEW LABEL EACH RUN: a label is taken for good (a revoked one too), and a computer that already holds a card of that
 * label makes nothing - no sheet comes. The time makes it this run's own; the testnet keeps the cards of runs before.
 */
const at = new Date();
const label = `${String(typeof LABEL === 'undefined' ? 'box claude' : LABEL)} ${at.toISOString().slice(5, 16).replace('T', ' ')}`;
drive.say(`the card: edge setup --label "${label}"`);
output.__card = drive.machine('cli', drive.app.shell, { argv: ['edge', '--test-mode', 'setup', '--label', label] }).catch((e) => ({ ok: false, why: e.message }));

/*
 * THE CARD IS ASKED FOR BESIDE THE FLOW (card.yaml): `onlykey-js edge --test-mode setup --label <LABEL>` on the app's own
 * machine (the drive's cli action, its output live in the drive window's cli tab) - not awaited here: the flow goes on to
 * approve the card on this app's sheet, and card-end.js takes its verdict.
 */
const label = String(typeof LABEL === 'undefined' ? 'box claude' : LABEL);
drive.say(`the card: edge setup --label "${label}"`);
output.__card = drive.machine('cli', drive.app.shell, { argv: ['edge', '--test-mode', 'setup', '--label', label] }).catch((e) => ({ ok: false, why: e.message }));

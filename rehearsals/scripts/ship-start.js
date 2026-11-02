/*
 * THE SHIP STARTS BESIDE THE FLOW (ship-proof.yaml): `onlykey-js edge --test-mode control ship <the scratch repo> --max 1`
 * on the app's own machine (the drive's cli action, its output live in the drive window's cli tab) - not awaited here:
 * the flow goes on to approve its budget on this app's sheet, and ship-end.js takes its verdict. The scratch repo is the
 * box's (~/scratch/ship-proof: one unsigned commit after origin/main, its remote the box's own sshd).
 */
const repo = '/home/bmatusiak/scratch/ship-proof';
drive.say(`the ship: batch 1 of ${repo} (--max 1)`);
output.__ship = drive.machine('cli', drive.app.shell, { argv: ['edge', '--test-mode', 'control', 'ship', repo, '--max', '1'] }).catch((e) => ({ ok: false, why: e.message }));

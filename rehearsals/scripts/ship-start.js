/*
 * THE SHIP STARTS BESIDE THE FLOW (ship-proof.yaml): `onlykey-js edge --test-mode control ship <the scratch repo> --max 1`
 * on the app's own machine (the drive's cli action, its output live in the drive window's cli tab) - not awaited here:
 * the flow goes on to approve its budget on this app's sheet, and ship-end.js takes its verdict. The scratch repo is the
 * box's (~/scratch/ship-proof: one unsigned commit after origin/main, its remote the box's own sshd).
 */
/* the CLI on the app's own chain: the testnet only when the app is on it (2026-11-05: blue-key on the box desktop is on the live chain, and --test-mode found no checkpoint there) */
const NET = drive.app.net === 'test' ? ['--test-mode'] : [];
const repo = '/home/bmatusiak/scratch/ship-proof';
/* COMMITS: the flow's env (ship.yaml, --env COMMITS=N) - the commits ship-proof-commit.js just made */
const max = String(Math.max(1, parseInt(typeof COMMITS === 'undefined' ? '1' : COMMITS, 10) || 1));
drive.say(`the ship: batch of ${max} from ${repo} (--max ${max})`);
output.__ship = drive.machine('cli', drive.app.shell, { argv: ['edge', ...NET, 'control', 'ship', repo, '--max', max] }).catch((e) => ({ ok: false, why: e.message }));

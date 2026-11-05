/*
 * `onlykey-js edge --test-mode setup` beside the flow (agent-setup.yaml): the testnet agent identity's labels - an ssh
 * user@host and a gpg user ID of this machine's own, never a real address - asked on the app's machine (the drive's cli
 * action), not awaited: the flow approves it on this app's sheet, and setup-end.js takes its verdict.
 */
/* the CLI on the app's own chain: the testnet only when the app is on it (2026-11-05: blue-key on the box desktop is on the live chain, and --test-mode found no checkpoint there) */
const NET = drive.app.net === 'test' ? ['--test-mode'] : [];
output.__setup = drive.machine('cli', drive.app.shell, {
  argv: ['edge', ...NET, 'setup', '--ssh', 'ssh://claude@zbox-test', '--gpg', 'Claude (zbox testnet) <claude@zbox-test.invalid>'],
}).catch((e) => ({ ok: false, why: e.message }));

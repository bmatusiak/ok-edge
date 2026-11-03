/*
 * A CLI's presses through this app (cli-press.yaml): `onlykey-js edge --test-mode setup` on the app's machine, beside the
 * flow (the drive's cli action, not awaited) - its certificate's two signatures are presses the key confirms with a code,
 * asked by the CLI and shown on this app's sheet (node-onlykey-lib desktop link: the CLI's 'press' / progress). Labels of
 * the rehearsal's own, never a real address; --created now, so each run makes a new certificate and asks the key again.
 * setup-end.js takes its verdict. Testnet only (--test-mode).
 */
const created = Math.floor(Date.now() / 1000);
output.__setup = drive.machine('cli', drive.app.shell, {
  argv: ['edge', '--test-mode', 'setup', '--ssh', 'ssh://rehearsal@cli-press', '--gpg', 'Rehearsal (cli press) <rehearsal@cli-press.invalid>', '--created', String(created)],
}).catch((e) => ({ ok: false, why: e.message }));

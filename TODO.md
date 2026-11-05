# TODO - where we left off (2026-11-05)

The project is moving into a rework (details are kept private, outside this repo). Everything below is the state at the
pause: what is done, what is paused, and what was next.

## Where we left off

- **v0.0.15 is published** (release workflow run 42096461702, every job green). It is the one-time debug-keystore
  release: `gh workflow run release.yml -f kind=release -f signer=debug`. The live `/release.json` names 0.0.15 with
  `com.okedge.debug` only - no `com.okedge` was ever signed with the debug keystore.
- **The remote MCP runs the new code** (`ok-edge.bmatusiak.workers.dev/mcp`: `hello status card_new plan_new
  plan_target plan_remove plan_show plan_submit plan_data plan_wait plan_finish`).
- **Pushed:** node-onlykey-lib `58ebcc6`, node-onlykey-emulator `39e3488`, onlykey-testing `9102bd4`, ok-edge `dc7b402`.
- **Not pushed (ok-edge, committed):** `5e011fe` the budget sheet follows a computer's uses (the "0 of 87 uses spent"
  sheet after ship 2), `0bcc0ed` progress held under an action sheet is said and counted by the sheet inspector,
  `066c2e9` and `abfa147` rehearsal fixes for a hard key on the live chain.
- **red-key** runs the 0020 prod hex; its RSA3 certificate is `signing/release.crt.pem` (SHA-256 5410CBAB...0DC0).

## Paused (the plan's remaining steps)

1. **Remote-MCP testing on red-key (step 5):** a fresh signer agent over the remote MCP -
   `node tools/release/apk-sign/sign.js card --server https://ok-edge.bmatusiak.workers.dev/mcp --identity <identity>
   --cert signing/release.crt.pem --key-file ~/.okedge/release-signer.json --name "ok-edge release signer"` - Accept it
   on the Edge tab, approve its card (one press), then sign a test APK over the remote MCP (Approve + one press); it must
   verify with 5410CBAB... and the sheet must count "2 of 2".
2. **The secret and variable:** `OKEDGE_SIGNER` = that new agent's key (set from its file, never pasted - the local
   signer's key was shown in a chat once, so it is not reused), `OKEDGE_IDENTITY` = the identity public key.
3. **The live release (step 6):** bump to 0.0.16 (a ship on red-key), then `gh workflow run release.yml -f kind=release`
   - the CI signer asks over the remote MCP, Approve + one press, `com.okedge` signed by RSA3.
4. **Then:** git commits signed over the MCP, approved by content (each commit's tree, message and author checked on
   the desktop before it is signed - a re-signed chain has no fingerprints up front).

## Open, found

- **Proving the sheet fix on a box ship:** the box CLI needs its own live-chain agent card on blue-key (the card made
  from the testnet side holds the label) - then `run.js rehearse --app desktop@box login ship --env COMMITS=3 --env
  USES=4` checks "4 of 4 uses spent".
- **The box keeps two keys restored from one backup** (one device id; its copy reads "tampered").
- **The first reads after a key restart on red-key** - not seen again since patch 0020.
- **The drive's LED triggers** still in the drive (press responder, unlockOutsideKey, gadgetWaits) - a replacement
  signal for the web app is needed first.
- **The firmware record** (b4c1640f) is not yet marked as run on a hard key (`node tools/firmware.js tested "..."`
  after a flash).
- **Patches to Tim:** 0019 and 0020 are the owner's call (in our builds, not sent; keep testing 0020); 0018 under
  review; 0015 next; 0016 later; 0017 when the owner says.
- **Decisions waiting:** a heading or red button on the config-mode PIN page; the add-a-key wizard's other imports.
- **A hardware check of 0018's bug** on a test key, with the owner's OK - never red-key's second PIN.

## Rules that still hold

- One PIN in the app: 1234561. 1111111 is only node-onlykey-testing's; a key the kit used is cleared
  (`tools/box/hardkey-clear.js`) and set up by the app (`hardkey-setup` rehearsal) before the app touches it.
- blue-key is disposable: always assume it empty; a flow sets up what it needs.
- red-key is the owner's hands only. Commits go unsigned and are pushed only through `edge control ship` on red-key.
- Test key before live key; rehearsals on the box before Windows.

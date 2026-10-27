# firmware/

The OnlyKey firmware this web app works with, for a **developer** key (unsigned; a production key loads signed
firmware only). The web app's Downloads page offers it from `/firmware/` with its sha256, and the Android app carries
it in its assets (`developer_firmware/`), for flashing from the phone one day.

**main holds the record only** - `manifest.json`: what the hex is built from, its build hash, the emulator commit
(`emulatorCommit`), and whether that build has run on a hard key. The hex itself is built by the release workflow
(`.github/workflows/release.yml`, run by hand) and published in the GitHub release and on the `cloudflare` branch
(`docs/firmware/`). A hex built here for a key on the bench stays in this folder untracked (`.gitignore`).

    node tools/firmware.js build               # on the box (a hex for the bench + the record); skipped when up to date
    node tools/firmware.js tested "<what ran>"  # after the recorded build passed on a hard key
    node tools/firmware.js check               # the record is the build of the current sources (the pre-push hook)
    node tools/firmware.js ci-build ...        # the workflow's build, with no box
    node tools/firmware.js install-hook        # once per clone

What the build is: OnlyKey 3.1.0 at the release pins in node-onlykey-emulator's `scripts/versions/v3.1.0.js`, with
the maintainer patches staged on them (`fixes`) and the firmware plugins `edge`, `ctap_bridge` and `derive_secret` -
`ctap_bridge` is what lets a browser reach the key over WebAuthn, its allowed site `ok-edge.bmatusiak.workers.dev`
while none is set in config mode. DEBUG on (the debug console). `buildHash` is one hash of all of it (pins, fixes,
plugins, and the emulator's tree hashes in `sources`): the same inputs give the same hash, and the hash is linked into
the hex itself, so a hex says what it was built from.

`tested` says whether the recorded build has run on a hard key yet; the page says so when not. The workflow's hex keeps
the mark only when its build hash is the record's.

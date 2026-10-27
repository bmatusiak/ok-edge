# firmware/

The OnlyKey firmware this web app works with, for a **developer** key (unsigned; a production key loads signed
firmware only). The server publishes this folder at `/firmware/` (mcp-server/build-webapp.js copies it into `docs/`),
and the web app's login page offers the `.hex` named in `manifest.json`, with its sha256.

**Cloudflare does not build firmware** - it publishes this folder as committed. So the hex is built here first, and a
push to `main` or `cloudflare` (both deploy) is refused while it is not the build of the current sources:

    node tools/firmware.js build               # on the box, with the OnlyKey Docker toolchain; skipped when up to date
    node tools/firmware.js tested "<what ran>"  # after this exact hex passed on a hard key
    node tools/firmware.js check               # what the pre-push hook runs
    node tools/firmware.js install-hook        # once per clone

What the build is: OnlyKey 3.1.0 at the release pins in node-onlykey-emulator's `scripts/versions/v3.1.0.js`, with
the maintainer patches staged on them (`fixes`) and the firmware plugins `edge` and `ctap_bridge` - `ctap_bridge` is
what lets a browser reach the key over WebAuthn, its allowed site `ok-edge.bmatusiak.workers.dev` while none is set
in config mode. DEBUG on (the debug console). `buildHash` is one hash of all of it (pins, fixes, plugins, and the
emulator's tree hashes in `sources`): the same inputs give the same hash, so an up-to-date build is not built again.

`tested` in the manifest says whether this exact file has run on a hard key yet; the page says so when not.

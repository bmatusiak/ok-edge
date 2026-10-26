# firmware/

The OnlyKey firmware this web app works with, for a **developer** key (unsigned; a production key loads signed
firmware only). The server publishes this folder at `/firmware/` (mcp-server/build-webapp.js copies it into `docs/`),
and the web app's login page offers the `.hex` named in `manifest.json`, with its sha256.

What the build is: OnlyKey 3.1.0 (OnlyKey-Firmware `9fceea1`, libraries `b273489`) with the firmware plugins in
`manifest.json`, from node-onlykey-emulator's `emulator/plugins/` - `ctap_bridge` is what lets a browser reach the key
over WebAuthn, its allowed site `ok-edge.bmatusiak.workers.dev` while none is set in config mode. DEBUG on (the debug
console). Built with the official OnlyKey toolchain (Arduino 1.6.5-r5 / Teensyduino 1.27, Docker):

    PLUGINS=config,edge,key_chain,fix_usertimeout,ctap_bridge bash emulator/plugins/edge/tools/build-hardkey.sh

`tested` in the manifest says whether this exact file has run on a hard key yet; the page says so when not.

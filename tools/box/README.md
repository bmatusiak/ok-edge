# tools/box - driving the Linux dev box

The box (ZBOX, `bmatusiak@192.168.51.113`) builds and runs; Windows stays the git home. Clones live in
`~/project/onlykey/` (lib, ok-edge, emulator side by side); every step appends to `~/project/onlykey/steps.log`.
The xrdp desktop is display `:10`; the Pixel is on the box's adb (`ANDROID_SERIAL=26251JEGR09693`).

| Script | Runs on | What |
|---|---|---|
| `sync-to-box.sh [lib] [edge] [emu]` | Windows | bring the box clones to the committed heads (git bundles, fast-forward only) |
| `desktop-test.sh` | box | start the ok-edge desktop TEST build on `:10` (the sync service from the lib checkout) |
| `dclick.sh x,y wait:N type:T key:K` | box | click / type in the desktop window by screenshot coordinates; saves `/tmp/okd.png` |
| `pixel-tab.sh <Tab>` | box | open an ok-edge tab on the Pixel and prove it is on screen |
| `press-watch.sh [seconds]` | box | TESTNET ONLY: tap the Pixel's press sheet whenever it shows |
| `softkey-gadget.sh start\|stop\|status` | box | a copy of the testnet soft key as a real USB OnlyKey (emulator gadget) for browsers |
| `devcert.sh` | box | once: a local CA + an `apps.crp.to` certificate, and its SPKI hash for Chromium |
| `webapp.sh build\|serve\|browser\|shot\|stop` | box | build `docs/`, serve it as `https://apps.crp.to:8443`, open Chromium on `:10`, screenshot |
| `serve-docs.js <docs> <certs> [port]` | box | the HTTPS static server `webapp.sh serve` uses (a stand-in until `mcp-server/`) |

Why `apps.crp.to`: the testnet soft key is a production build, which accepts WebAuthn only from apps.onlykey.io /
apps.crp.to; Chromium maps the name to the box (`--host-resolver-rules`) and accepts the dev certificate by its key
(`--ignore-certificate-errors-spki-list`), so nothing on the box's own name resolution changes.

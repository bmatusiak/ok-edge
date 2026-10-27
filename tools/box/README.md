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
| `page-console.js [seconds] [--reload] [--filter=RE]` | box | stream the web app's console from Chromium (DevTools port 9333) |
| `serve-docs.js <docs> <certs> [port]` | box | the HTTPS static server `webapp.sh serve` uses (a stand-in until `mcp-server/`) |

Why `apps.crp.to`: the testnet soft key is a production build, which accepts WebAuthn only from apps.onlykey.io /
apps.crp.to; Chromium maps the name to the box (`--host-resolver-rules`) and accepts the dev certificate by its key
(`--ignore-certificate-errors-spki-list`), so nothing on the box's own name resolution changes.

## The local server vs the deployed one (M2, 2026-10-26)

`HTTPS=1 tools/box/server.sh start` runs the same Worker (`mcp-server/`, the rooms and the web app) as Cloudflare does
at ok-edge.bmatusiak.workers.dev. Proven locally: a blank web app (hard key 2 in Chromium) filled from the CLI (the
testnet soft key) through the room - 56 items, every store the same after. Where the two differ, and what bridges it:

| | local (the box) | deployed |
|---|---|---|
| name | `apps.crp.to` mapped to the box by Chromium's flag; Node/CLI do not see that - they use `localhost` | real DNS |
| TLS | the dev CA: Chromium trusts its key by flag; Node needs `NODE_EXTRA_CA_CERTS=~/project/onlykey/devcert/ca.crt` (the cert names `apps.crp.to` and `localhost`) | a public certificate |
| the join's host | each device signs the host it reached (`apps.crp.to:8787` or `localhost:8787`); the server checks that same host, so both are valid in one room | one host |
| the key's site | `apps.crp.to` is a site every 3.1.0 key trusts | `ok-edge.bmatusiak.workers.dev`: only a key with the ctap_bridge plugin (its default site) |
| the web app files | `wrangler dev` reads the asset list at start: restart it after a rebuild | uploaded with each deploy |
| the build | `CI=1 node mcp-server/build-webapp.js` for the release build Cloudflare makes | the same, in Workers Builds |
| Durable Objects | miniflare's local SQLite; idle sockets are not really hibernated | hibernation on Cloudflare |

The CLI on the box: `printf "<PIN>\n" | NODE_EXTRA_CA_CERTS=… onlykey-js --soft-key --test-mode bucket sync --server https://localhost:8787 --test-mode`
(the desktop app not running: `--soft-key` boots its soft key).

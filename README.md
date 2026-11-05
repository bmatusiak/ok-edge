# ok-edge 0.0.15 (v0.0.15)

an unofficial research and development version - not an official OnlyKey product. Built by the release workflow (run 42096461702) from `dc7b402` on 2026-11-05.
The release: https://github.com/bmatusiak/ok-edge/releases/tag/v0.0.15. Everything below is `docs/release.json`, which the site serves at `/release.json`.

## Downloads

| | file | size | sha256 |
|---|---|---|---|
| Android app | [onlykey-edge-0.0.15-1932.apk](https://github.com/bmatusiak/ok-edge/releases/download/v0.0.15/onlykey-edge-0.0.15-1932.apk) | 93.3 MB | `516763f7711803d090438c4d333ed03a0d4cc7bf14c8661bc850fe9705a849d7` |
| Desktop app, Windows (x64) | [onlykey-edge-desktop-0.0.15-1932-windows-x64.zip](https://github.com/bmatusiak/ok-edge/releases/download/v0.0.15/onlykey-edge-desktop-0.0.15-1932-windows-x64.zip) | 192.2 MB | `3f7aa31060d590e31af7531878c6b56254feb1e24ec046260dc6281dd93d74b1` |
| Desktop app, Linux (x64) | [onlykey-edge-desktop-0.0.15-1932-linux-x64.tar.gz](https://github.com/bmatusiak/ok-edge/releases/download/v0.0.15/onlykey-edge-desktop-0.0.15-1932-linux-x64.tar.gz) | 170.3 MB | `082da3a809b4052dcdc358010b72b67f71bf7db52583314c69ece4f457af323a` |
| Firmware, prod | [v3.1.0-prod-edge-ctap_bridge-vendor_bridge-derive_secret-version_control-fw80e3ba0-libfe9e293-fix0012-0013-0015-0016-0017-0018-0019-0020-bb4c1640f.hex](https://github.com/bmatusiak/ok-edge/releases/download/v0.0.15/v3.1.0-prod-edge-ctap_bridge-vendor_bridge-derive_secret-version_control-fw80e3ba0-libfe9e293-fix0012-0013-0015-0016-0017-0018-0019-0020-bb4c1640f.hex) | | `8939bd2e95f34ad342cacabf001fe7b55ef960fd05a2aab6e7b7ef45aea79322` |
| Firmware, test (DEBUG console - test keys only) | [DANGEROUS-v3.1.0-test-edge-ctap_bridge-vendor_bridge-derive_secret-version_control-fw80e3ba0-libfe9e293-fix0012-0013-0015-0016-0017-0018-0019-0020-bb4c1640f.hex](https://github.com/bmatusiak/ok-edge/releases/download/v0.0.15/DANGEROUS-v3.1.0-test-edge-ctap_bridge-vendor_bridge-derive_secret-version_control-fw80e3ba0-libfe9e293-fix0012-0013-0015-0016-0017-0018-0019-0020-bb4c1640f.hex) | | `a4d31387c6da0b6abee98597b484d152cf5c35159844ddf47b33527fffb81ebf` |

The Android app is signed with the certificate `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`.
Check a download: `sha256sum <file>` (Linux) or `certutil -hashfile <file> SHA256` (Windows) must print the sha256 above.

## Firmware

OnlyKey firmware v3.1.0 (OnlyKey-Firmware `80e3ba0`, libraries `fe9e293`), built from node-onlykey-emulator `39e3488` (build b4c1640f501ae2fc).

- fixes: `0012`, `0013`, `0015`, `0016`, `0017`, `0018`, `0019`, `0020`
- plugins: `edge`, `ctap_bridge`, `vendor_bridge`, `derive_secret`, `version_control`
- the prod hex is on the site and in the Android app; the test hex (DEBUG console - it prints key data) is on the GitHub release alone, for test keys only.

## The soft key in each app

| app | version | fixes | plugins |
|---|---|---|---|
| Android | v3.1.0 | 0012, 0013, 0015, 0016, 0017, 0018, 0019, 0020 | config, edge, key_chain, ctap_bridge, vendor_bridge, derive_secret, version_control |
| Desktop, Windows | v3.1.0 | 0012, 0013, 0015, 0016, 0017, 0018, 0019, 0020 | config, edge, key_chain, ctap_bridge, vendor_bridge, derive_secret, version_control |
| Desktop, Linux | v3.1.0 | 0012, 0013, 0015, 0016, 0017, 0018, 0019, 0020 | config, edge, key_chain, ctap_bridge, vendor_bridge, derive_secret, version_control |

The web app (build `dc7b402-mw3yuwof`) has no soft key: it uses the key in your hand.

## This branch

- `docs/` - the web app, `docs/firmware/` (the prod hex) and `docs/release.json`; `release.json` here is a link to it
- `worker/`, `wrangler.json` - the Worker; Cloudflare deploys this branch as it is, nothing is built here (by hand: `npx wrangler deploy` in this folder)
- nothing here is source: each release replaces all of it; the source and the workflow are on `main` (`.github/workflows/release.yml`)

This product includes software developed by CryptoTrust LLC. for the OnlyKey Project (https://crp.to/ok)

# TODO: Edge on the hard key, and Stages 4-5 built around it

Brad, 2026-10-22: "i want to see if we can add edge to a hardkey so we can focus on development using hardkey with edge, so stages 4 and 5 can be the proper direction instead of guessing".

So the order is: **Edge runs on a developer hard key first**; then Stage 4 (desktop) and Stage 5 (web) are built as what that key needs from a computer, not guessed from the phone.

Facts below are from the Edge plugin's own docs (`node-onlykey-emulator/emulator/plugins/edge`: README, WHITEPAPER §3, AUDIT, SPEC) unless marked otherwise.

## A. Edge on a developer hard key (firmware)

**A1 result (2026-10-23, read from `OnlyKey-Firmware 9fceea1` + `libraries 37aa531`, and the dev hex itself):**

| Region | Range | Owner |
|---|---|---|
| Dev hex (HalfKay, linked at 0: no OnlyKey bootloader) | `0x00000`-`0x33077`, 209,016 B, one image | code |
| Free on a dev key | `0x33078`-`0x3A7FF`: whole sectors `0x33800`-`0x3A7FF` = 14 x 2 KB | nobody - nothing in either repo addresses it |
| Data storage (`flashstorestart`-`flashend`) | `0x3A800`-`0x3FFFF`, 11 x 2 KB | sector 1: temp (wiped by the bootloader on firmware load); sectors 2-11: all have owners in `okcore.cpp` |
| Production firmware window (`fwstartadr`) | `0x06060`-`0x3A05F` | `fw_hash()` (OnlyKey.ino) hashes all of it once, at first boot, into EEPROM 2-65 "for integrity verification"; nothing in the firmware reads it back - the signed bootloader does |

**Chosen for the developer build:** Edge's two sectors at **`0x39800` and `0x3A000`**, the last two free sectors before the data storage, and a build-time check that the code ends below `0x39800`. The top two, because the code grows up towards them: the maintainer's test hex ends at `0x33077`, but OUR rig's DEBUG builds are ~13 KB larger (plain RC 222,284 B; with 0008-0010 222,540 B, ending `0x3654B`), so 3.1.0 + 0008-0010 + Edge (~8 KB) ends near `0x38400` - `0x39000` would have left ~3 KB, `0x39800` leaves ~5 KB. No 3.1.0 region moves, so the A1 question below is moot for developer builds. (First chosen as `0x39000`/`0x39800` from the maintainer's hex alone; moved before anything was built.)

**Not for production as is:** on a production key those sectors are inside the hashed firmware window, so every Edge write would change what the bootloader verifies. A production port needs its place chosen by the maintainer (A5).

| # | Task | What we know | Done when |
|---|---|---|---|
| A1 | **Find the flash.** Edge keeps one 208-byte record (`OKEDGEv1`), double-buffered across two sectors. On the soft key they are `base + 0x1000` / `+ 0x1800` (`factorysectoradr - 0x4800`), which on a real Teensy is the **bootloader's** - so a hard key needs two free 2 KB sectors elsewhere in 3.1.0's flash map. | "A hard key has no free flash sector for the plugin's state today" (WHITEPAPER §3). Teensy 3.2: 256 KB flash, 2 KB sectors. | A flash map of 3.1.0 on Teensy 3.2 (code end, every data sector and its owner) and a chosen place, or a measured "no room" with what would have to move. |
| A2 | **Fit the size.** 7,716 B code, 325 B constants, 2,761 B RAM (measured 2026-10-10 on the Pi, Teensy 1.6.5-r5, `-Os`). Trims if short: held links 8 → 4 (-544 B RAM), drop the record's latest link (64 B). | His dev hex is 209,016 B = 79.7% of 256 KB (`okt flash`, 2026-10-22), so ~52 KB code room - before data sectors are counted. RAM headroom on 3.1.0 not measured yet. | A Teensy 3.2 build of 3.1.0 + Edge that links, with its flash and RAM use printed. |
| A3 | **Build it where firmware is built.** The Pi is the firmware build and flash station (Arduino 1.6.5-r5 + Teensyduino 1.27). The plugin's eight hooks are applied by the emulator's `stage.js`; a hard-key build needs the same hooks applied to `OnlyKey-Firmware 9fceea1` + `libraries 37aa531`. | `plugin.js` declares `minBase: '3.1.0'`, `backup: true`, eight hooks (okcore.cpp x6, OnlyKey.ino x2). | `ok-<fw>-<lib>-edge-test.hex`: his release commits + Edge, DEBUG on (console presses for tests), reproducible from one command. |
| A4 | **Flash a developer key and test it.** We have two developer keys (2026-10-22). One stays on his plain dev hex for release testing; the other takes the Edge build. HalfKay only, never OKFWUPDATE. | The kit drives a physical key on Linux and now on Windows (kit `c7e1ed2`..`e4e9191`). | The plugin's own tests (`plugins/edge/tests`) and the kit's protocol sections pass against the hard key; a budget opened by a press on the key pays signs without presses. |
| A5 | **Upstream stays his call.** "Any port is for the firmware maintainers to decide" (WHITEPAPER §3). Release hexes are signed by T. So an Edge hard key is a developer-key build for us, until the maintainer chooses otherwise. | | Written down in the plugin docs: what a hard-key port changes in the core, measured. |

## B. Stage 4 - the desktop is the hard key's Edge host

On the phone, the soft key's host is the phone itself: it shows the sheets and keeps the chain. A hard key has no screen, so **the desktop app takes that role** (SPEC H2, H7: "A hard key has no phone: the desktop app keeps the record (later)").

**ok-edge is three apps in one** - mobile, desktop, web app (over MCP) - **and the CLI talks to each, named by a flag** (Brad, 2026-10-23):

| CLI | Talks to | The key | The host (sheet, records) | Pairing |
|---|---|---|---|---|
| (no flag) | a hard key on USB, directly | the hard key | the CLI itself: terminal y/N (`edge/cli/local-host.js`) | none |
| `--ble` | ok-edge **mobile** | its soft key | the phone | Part T |
| `--desktop` | ok-edge **desktop**, same machine | its hard key (USB) or its emulator soft key | the desktop app | none |
| `--mcp` | the ok-edge **web app** | the page's key (WebAuthn) | the page | the CLI pairing |

**Who talks to what** (Brad, 2026-10-23):
- **The desktop app's keys are its own:** a hard key over USB, and the emulator as its own soft key - as the Android app has its own soft key. **The desktop app has no Bluetooth at all**; it does not reach phones.
- **A phone manages itself through the CLI:** `onlykey-js --ble` to the Android app (Part T pairing; proven box ↔ Pixel on testnet, 2026-10-23).
- **The CLI ↔ the desktop app: no pairing** - they run on the same machine; the desktop app is the host for the CLI's commands (its sheet, its records) in place of the terminal y/N.
- **The web app needs the CLI pairing**, because it is reached over MCP, not on the same machine.

| # | Task | What we know |
|---|---|---|
| B1 | **The hard key over USB** in the desktop app. | ✅ Done: the lib's node-hid pipe in Electron's main process (ok-edge `5c9d893`, lib `e80d233`); console presses on a DEBUG key. |
| B2 | **The budget sheet on the desktop**: what is being approved (reason, scopes, uses, lifetime) shown on the computer before the press on the key. On the phone this is the yellow Edge sheet. | Design is Brad's call. A hard key "never exposes that record" (SPEC H2) - the host must show what it sent, and the press is the person's agreement to that. |
| B3.0 | **Identities kept apart** (Brad, 2026-10-24: "a user has 2 different keys, 1 for gitlab and another for github for a completely different company - they must not merge storage or blockchain data"). The identity id = the key's OWNER public key fingerprint (no salt: the same on every device restored from one backup, different across backups) - the same id that groups devices for sync (B3 b). Every Edge record is filed under the identity of the key plugged in: the agent identity record and its certificate files (today ONE per net: a second key's setup would overwrite the first), budgets / pointers, device names, the `edge control` batch, the history grouping; chain copies stay per device, listed under their identity. Today's records migrate to key 1's identity by matching the certificate to the key's derived key. The CLI and the desktop select by the key that is in; an identity with no records starts empty. **Asked at login** (Brad, 2026-10-24: "we need to ask the key on edge app login what key identity is in so it can load the proper data store"): a locked key answers nothing, so a connected-but-locked key shows no Edge records ("unlock to load"); at unlock the app reads the owner key (`edge.statement()` / `edge.publicKeyPq('owner')`: reads, no press, no link) and loads that identity's store; a key unplugged, swapped or locked drops it. The CLI reads it right after connecting, per command. **The mobile app too** (Brad, 2026-10-24: "if i plug a different hardkey into the mobile app it should register as a different identity, for example the testnet key"): its Edge records are filed by net only today (`okrn.edge.*` / `okrn.edge.test.*`, soft-key centred) - they become net + identity (`okrn.edge[.test].<identity id>.*`); the phone's soft key is one identity, each hard key plugged in over USB its own; the existing records migrate to the soft key's identity. Net and identity are two separate axes: key 2 is both a different identity and the testnet. **The bucket file** (Brad, 2026-10-24: "a bucket file transferred from app to app or host to host is encrypted to each key's main identity, not the device salt identity"): sealing is already AES-256-GCM under `okcrypto.deviceVault.key('bucket')` (HKDF over the key's shared secret - from the backup, so the same on every device of one identity; to be proven on two devices of one backup, e.g. A13 + Pixel or key 1); but today `bucket.json` holds EVERY identity's stores and `bucket export` seals the whole file under the key plugged in - so export takes only that identity's stores, and import opens only with a key of that identity and merges into that identity's stores alone. Tests with two identities: nothing crosses. | First: B3's views and sync build on it. |
| B3 | **The hard key in the desktop's Edge screens**, from the shared records (`~/.onlykey-js`, the same bucket as the CLI - Brad, 2026-10-24). Today the Edge tab and the Edge management menu follow the soft key only, so for a hard key they are empty. (a) **The Edge tab**: the hard key's budgets, presses and chain copy. (b) **Edge sync = every budget used by ANY device holding this key**: the phones and the hard key restored from the same backup (each its own device salt and chain), merged into one view in the shared records. The teams (Brad, 2026-10-24): CLI + desktop (hard key), CLI + phone (BLE), headless CLI + hard key - any combo of phones and hard keys under one identity. The CLI is in every team, so its records are the meeting point: history grouped by identity; `edge sync --all` offers the hard keys' logs to the phones too; across computers, the bucket as a file (B6) or the web app (C4). (c) **The Edge management menu**: "my device name" for this salt / key id, kept in the shared records so the CLI, the desktop and the other devices' views show the same name. | The CLI's records are there already (`edge.copies` with the openings, `edge.identity`, `edge.budgets`, `edge.pointers`); the page reads them through the main process. The CLI's `edge sync --all` already pulls every paired phone into this PC's copies. |
| B4 | **The agent runs against the hard key**: `onlykey-js edge budget/exec/receipt/end` over USB instead of Bluetooth, and the edge skill's `ship` through it. | ✅ Testnet key 2 on the box: the CLI is the host (`edge/cli/local-host.js`: terminal y/N, then the press). Live key 1 (Windows, Brad presses) still to run. |
| B4b | **`onlykey-js --desktop`**: the CLI talks to the desktop app on the same machine, no pairing - the desktop app owns its keys (hard key, emulator soft key) and is their host (its sheet, B2; its records, B3), as the phone is for `--ble`. | No flag stays the CLI straight to a hard key, terminal y/N. **Design (Brad):** treated like `--ble` - the desktop app does the USB talking; the channel is a local **IPC socket**; its security is a **file the app writes and the CLI reads** (same user, file permissions = who may connect; no pairing). |
| B4c | **The soft key on a computer** (Brad, 2026-10-23): the emulator as the key of the process. **CLI `--soft-key`**: the soft key runs in the CLI's process; its PIN and its presses come through the terminal (stdio). **Desktop app**: its own soft key, with its own window for the PIN keypad and the press. Both keep its image in `~/.onlykey-js`. | After B4b. Same-user caveat: a terminal press is only as private as the user account - the desktop window is the stronger of the two. |
| B5 | ~~The phone over Bluetooth to the desktop~~ - dropped (Brad, 2026-10-23): a phone manages itself through the CLI over BLE; the desktop app only has its own keys. | |
| B6 | The bucket as a file; packaging (Windows + Linux, a Node runtime for the soft key's process). | Unchanged from the plan. |

## C. Stage 5 - the web, for a hard key with Edge

| # | Task | What we know |
|---|---|---|
| C1 | **The transport is FIDO2 / WebAuthn only.** Chrome blocks the OnlyKey from WebHID (Brad's bug bounty, patched at Google). Edge is a vendor message (`0xF8`), so on the web it rides the vendor-over-WebAuthn path. | The lib has `transport/webauthn`; apps.onlykey.io's transit is the reference. |
| C2 | **The origin.** A production key admits the vendor-over-WebAuthn path only from `apps.crp.to` / `apps.onlykey.io` (`webcryptcheck()`); a DEBUG build admits any origin. So development on a developer key works anywhere; a production key needs one of those two origins (the hosts-file + local CA plan in the plan file). | lib `src/protocol/ctap.js`. |
| C3 | **Proof first**: one Edge round trip (status, then a budget opened by a press) from a page in Chrome to the Edge hard key over WebAuthn. Then the same screens as the desktop (B2, B3) on the web. | Web Bluetooth to the phone stays unproven (Chromium's blocklist to check). |
| C4 | The bucket on the page: drop, merge, download. | Unchanged from the plan. |
| C5 | **`onlykey-js --mcp`**: the CLI and the web app over MCP, so it needs the CLI pairing (not on the same machine, unlike the desktop app). | PROPOSAL-webapp-mcp.md. **Design (Brad):** the pairing uses an **age identity public key**; **socket.io** finds the other side and carries the pairing over the internet. |

## Order

1. Finish the 3.1.0 release-candidate deep test (in progress, `onlykey-RN/release-3.1.0-test/REPORT.md`).
2. A1 → A2 → A3 → A4 (the Edge hard key).
3. B2 → B3 → B4 → B4b (the desktop as its host), then B6.
4. C3 → C4.

## Questions for Brad

- ~~A1: moving another region~~ - not needed: a dev key has 14 free sectors above its code (A1 result).
- A4: which developer key becomes the Edge key, and which stays on his plain dev hex?
- B2: how the desktop shows a budget request (window, notification, tray) - design call.

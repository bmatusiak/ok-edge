# ok-edge

**1 lib, 1 GUI, any platform**: a proof of concept.

The goal is to make Edge, Key Chain, Guest Book and Passwords easy to clean up and improve. Each one now lives in **one library** ([node-onlykey-lib](https://github.com/bmatusiak/node-onlykey-lib)) behind **one app** that is built for every platform:

| Platform | Reaches the key through |
|---|---|
| Android | the phone itself: hard key over USB, or the built-in soft key |
| Desktop (Electron) | the hard key over USB, or the phone's soft key over Bluetooth |
| Web | the hard key (WebHID), or the phone over Web Bluetooth |
| CLI (`onlykey-js`) | the same library, in a terminal |

No iOS: there is no way to test it.

## The bucket

Everything a front end keeps lives in **one portable file**: the Key Chain list, the Guest Book, password entries, the Edge chain copy, and settings.

- **It moves** between the phone, the desktop app, the web page and the CLI.
- **It is sealed by the key**, so it opens only with the OnlyKey that owns it. Development builds are unsealed.
- **It merges on import**, taking what each copy lacks. A setting both copies changed is shown with its dates for the person to pick. An Edge fork is reported, never repaired.
- **The audit dump** is the Edge chain only: blocks anyone can check with the device's public keys.

The bucket is in the library: `node-onlykey-lib/bucket`.

## Running it

Expo SDK 58 (React Native 0.88), Rectify 2.0, Electron 45. `npm install` first.

| Shell | Run | Build |
|---|---|---|
| Web app | `npm run webapp` (port 8090) | `npm run build:webapp`: `docs/` |
| Desktop | `npm run electron` (loads `dist/desktop`, built by `npm run build:desktop`), or `npm run electron:dev` with `npm run desktop:dev-server` running (port 8091) | `npm run build:electron`: `dist/electron/win-unpacked` |

Platform files: `x.android.ts`, `x.webapp.ts` and `x.desktop.ts` beside the contract `x.ts` (src/platform.ts). Expo bundles
the web app and the desktop both as Metro's `web`, so every web build names its platform - `OKEDGE_SHELL=webapp` or
`desktop`, set by the scripts above - and metro.config.js picks that platform's files; a web build without it is refused.
| Android | install the APK (`com.okedge`; it installs beside ok-rn's `com.okrn`) | `npm run build:android`, with `ANDROID_HOME` set to the SDK |
| CLI | `npm run cli -- help` (the library's `onlykey-js`) | |

`android/` is generated from `app.json` by `expo prebuild`; it is not in git. The desktop page has no Node: it reaches the main process only through `electron/preload.js` and its allowlisted channels.

## Status

ok-rn (the current Android app) stays in use until ok-edge can replace it. It is also the **oracle**: every ok-edge screen and flow is checked against it.

| Stage | What | State |
|---|---|---|
| 0 | the bucket, in the library | done |
| 1 | the four shells (Android, Electron, web, CLI), no features | done |
| 1b | one soft key: [node-onlykey-emulator](https://github.com/bm-ok/node-onlykey-emulator) built as a Node addon (CLI, desktop) and an Android library | done (the phone run comes with stage 2) |
| 2 | Android: hard key, soft key, Key Chain, Edge, the computer link; then the rest | next |
| 3 | the CLI on the bucket | |
| 4 | desktop (Electron) | |
| 5 | web | |

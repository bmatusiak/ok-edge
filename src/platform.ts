/**
 * WHICH SHELL THIS IS - decided by the BUILD, in one file per platform (PROPOSAL-one-gui.md, lessons from guncelium:
 * there the same check was copy-pasted into about eight files; PROPOSAL-rectify-ok-edge.md rule 2, Brad, 2026-10-30:
 * "each platform gets their own .platform.js for platform specific replacement").
 *
 *   android   the phone app (React Native)                      platform.android.ts  (Metro, Android)
 *   desktop   the desktop app: the web build in an Electron      platform.desktop.ts  (the desktop build,
 *             window, whose preload (electron/preload.js) puts                          OKEDGE_SHELL=desktop -
 *             `window.okedge` in place before the page runs                             metro.config.js)
 *   webapp    the web build in a browser (GitHub Pages, a        platform.webapp.ts      (Metro, web)
 *             fork's site, or served locally)
 *
 * It used to be guessed at run time (Platform.OS, then whether the preload's bridge was there), one build for the
 * desktop window and the browser. Now each build carries its own answer, and nothing anywhere asks at run time.
 *
 * THIS FILE is the contract: what TypeScript and Jest see (the web app's values), and the check that every platform
 * file exports the same names with the same types - a value added to one and not the others does not compile.
 *
 * NAMED FOR WHAT THE USER RUNS (Brad, 2026-10-26: "desktop is better than electron", and "web may be confusing"):
 * Electron stays the tool's name (the electron/ folder, the npm scripts); the shell is the desktop app.
 *
 * DEVICE_WORD: what this device is called in the app's sentences ("this phone is also the key").
 * SHOW_SCROLLBARS (Brad, 2025-10-25: "this scroll view on desktop has no scroll bars, it's not touch screen ready"):
 *   with a mouse a hidden bar means nothing says there is more below; every ScrollView's indicator props take it.
 * desktop: the preload's bridge, on the desktop shell only.
 */
import type * as Android from './platform.android';
import type * as Web from './platform.webapp';
import type * as Desktop from './platform.desktop';

export * from './platform.webapp';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
/* every platform file exports exactly the web file's names and types */
export const PLATFORM_FILES_AGREE: [Same<typeof Android, typeof Web>, Same<typeof Desktop, typeof Web>] = [true, true];

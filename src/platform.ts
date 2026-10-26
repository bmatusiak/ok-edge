/**
 * WHICH SHELL THIS IS - decided here and nowhere else (PROPOSAL-one-gui.md, lessons from guncelium:
 * there the same check was copy-pasted into about eight files).
 *
 *   android   the phone app (React Native)
 *   desktop   the desktop app: the web build in an Electron window, whose preload
 *             (electron/preload.js) puts `window.okedge` in place before the page runs
 *   webapp    the same web build in a browser (GitHub Pages, a fork's site, or served locally)
 *
 * NAMED FOR WHAT THE USER RUNS (Brad, 2026-10-26: "desktop is better than electron", and "web may be confusing"):
 * Electron stays the tool's name (the electron/ folder, the npm scripts); the shell is the desktop app.
 *
 * Everything else asks for SERVICES (src/app.ts), never for the platform: a capability a shell
 * lacks is a service that is absent, not a check scattered through the screens.
 */
import { Platform } from 'react-native';

export type Shell = 'android' | 'desktop' | 'webapp';

/** The desktop bridge the preload exposes - only `invoke` on an allowlisted channel. */
export type DesktopBridge = { invoke: (channel: string, ...args: unknown[]) => Promise<unknown> };

const bridge: DesktopBridge | null = (globalThis as { okedge?: DesktopBridge }).okedge ?? null;

export const shell: Shell = Platform.OS === 'android' ? 'android' : bridge ? 'desktop' : 'webapp';

/**
 * What this device is called in the app's sentences ("this phone is also the key"): the desktop is a computer; the
 * web app is a browser - what it keeps lives in this browser's profile, not on the computer.
 */
export const DEVICE_WORD = shell === 'android' ? 'phone' : shell === 'desktop' ? 'computer' : 'browser';

/*
 * SCROLLBARS ON THE DESKTOP AND THE WEB (Brad, 2026-10-25: "this scroll view on desktop has no scroll bars, it's not
 * touch screen ready"): a phone hides them - a finger swipes, and the page shows it moves - but with a mouse a hidden
 * bar means nothing says there is more below, and nothing to drag. Every ScrollView's indicator props take this one
 * value, so the choice is made here once.
 */
export const SHOW_SCROLLBARS = shell !== 'android';

/** The desktop bridge, on the desktop shell only. */
export const desktop: DesktopBridge | null = shell === 'desktop' ? bridge : null;

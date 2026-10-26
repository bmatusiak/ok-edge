/**
 * WHICH SHELL THIS IS - decided here and nowhere else (PROPOSAL-one-gui.md, lessons from guncelium:
 * there the same check was copy-pasted into about eight files).
 *
 *   android   the phone app (React Native)
 *   electron  the desktop app: the web build in an Electron window, whose preload
 *             (electron/preload.js) puts `window.okedge` in place before the page runs
 *   web       the same web build in a browser
 *
 * Everything else asks for SERVICES (src/app.ts), never for the platform: a capability a shell
 * lacks is a service that is absent, not a check scattered through the screens.
 */
import { Platform } from 'react-native';

export type Shell = 'android' | 'electron' | 'web';

/** The desktop bridge the preload exposes - only `invoke` on an allowlisted channel. */
export type DesktopBridge = { invoke: (channel: string, ...args: unknown[]) => Promise<unknown> };

const bridge: DesktopBridge | null = (globalThis as { okedge?: DesktopBridge }).okedge ?? null;

export const shell: Shell = Platform.OS === 'android' ? 'android' : bridge ? 'electron' : 'web';

/** What this device is called in the app's sentences ("this phone is also the key"): the desktop is a computer. */
export const DEVICE_WORD = shell === 'android' ? 'phone' : 'computer';

/*
 * SCROLLBARS ON THE DESKTOP AND THE WEB (Brad, 2026-10-25: "this scroll view on desktop has no scroll bars, it's not
 * touch screen ready"): a phone hides them - a finger swipes, and the page shows it moves - but with a mouse a hidden
 * bar means nothing says there is more below, and nothing to drag. Every ScrollView's indicator props take this one
 * value, so the choice is made here once.
 */
export const SHOW_SCROLLBARS = shell !== 'android';

/** The desktop bridge, on the electron shell only. */
export const desktop: DesktopBridge | null = shell === 'electron' ? bridge : null;

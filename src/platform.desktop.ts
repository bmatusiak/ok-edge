/*
 * THE DESKTOP APP (the web build in an Electron window) - platform.ts says what each value means; the desktop build
 * (OKEDGE_SHELL=desktop, metro.config.js) picks this file before platform.webapp.ts.
 */
import type {DesktopBridge, Shell} from './platform.types';

export type {DesktopBridge, Shell} from './platform.types';

/*
 * The preload (electron/preload.js) puts `window.okedge` in place before the page runs. A desktop build opened anywhere
 * else has no bridge: said at once, rather than a desktop app that silently cannot reach its key or its files.
 */
const bridge = (globalThis as {okedge?: DesktopBridge}).okedge;
if (!bridge) throw new Error('this is the desktop app\'s build - it runs only in the desktop app (no window.okedge here)');

export const shell: Shell = 'desktop';
export const DEVICE_WORD: string = 'computer';
export const SHOW_SCROLLBARS: boolean = true;
export const desktop: DesktopBridge | null = bridge;
/* the phone's Bluetooth (keyboard, security key, automations) is on this platform */
export const BLUETOOTH_HERE: boolean = false;
/* a login kept for this browser session, and the page's update check at the splash (webSession.ts, webUpdate.ts) */
export const WEB_SESSION: boolean = false;
/* the key is asked nothing until Log in (the web app: useWebKey armWebKey) */
export const KEY_WAITS_FOR_LOGIN: boolean = false;
/* a soft key to choose at the PIN screen, beside a plugged-in hard key */
export const SOFT_KEY_HERE: boolean = true;
/* the hard key is reached through WebAuthn only (useWebKey): no USB listing, so "attached" is not known until it answers */
export const KEY_OVER_WEBAUTHN: boolean = false;
/* this is a page in a browser tab: its own site (location), a reload logs out, downloads offered, other tabs, a service worker */
export const BROWSER_PAGE: boolean = false;
/* the idle end (idleTimer.ts) runs here - the web app's only, for now (Brad's call for the phone and the desktop) */
export const IDLE_END_HERE: boolean = false;
/* Android Autofill fills other apps' logins (Passwords) */
export const AUTOFILL_HERE: boolean = false;
/* unlock with biometrics (Android Keystore) */
export const BIOMETRICS_HERE: boolean = false;
/* the phone's own permissions, passkey provider and app capabilities (Preferences, This Key) */
export const PHONE_PERMISSIONS_HERE: boolean = false;
/* the native watchdog that says "Edge watching stopped" when the JS stops (its test button in testing mode) */
export const NATIVE_WATCHDOG_HERE: boolean = false;
/* the press chime is native (NativeOkEmu.chime) and the sheet's own sound is not played */
export const NATIVE_CHIME_HERE: boolean = false;
/* a key slot can be written: the vendor interface (not over WebAuthn) */
export const SLOT_WRITE_HERE: boolean = true;
/* the local MCP for this computer's agents runs in this app (electron/desktop/localMcp.js) */
export const LOCAL_MCP_HERE: boolean = true;
/* Settings: what Preferences holds here */
export const PREFERENCES_WHAT: string = "Settings you can change back: the key's own preferences and the keyboard layout.";
/* the Edge tab's Agents card: where an agent's request comes from here */
export const AGENT_FROM: string = "a computer agent on this computer (Sync tab)";
/* the test build's banner - the phone's says what adb could do with the debugging lock off */
export const TEST_BUILD_BANNER: string = "TEST BUILD - not a release";
/* a line under the Activity cards: how this platform reaches its other devices, where it needs saying */
export const ACTIVITY_NOTE: string | null = null;
/* how this device is named to the others in its room (src/serverRoom.ts; the key in use is added there) */
export function deviceName(): string { return 'Desktop'; }
/*
 * THE COMPUTER IN THE ROOM (S5b, 2026-11-02): this app and `onlykey-js --service` are one device - one id and one name,
 * the CLI's (~/.onlykey-js/device.json, node-onlykey-lib bucket/cli/home.js thisDevice), read by the main process.
 */
export async function computerDevice(): Promise<{id: string; name: string} | null> { return bridge!.invoke('okedge:roomDevice') as Promise<{id: string; name: string}>; }
/* the login's reason, as the key's log keeps it */
export function loginReason(): string { return 'log in: the desktop app'; }

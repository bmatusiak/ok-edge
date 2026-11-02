/* THE WEB APP (the web build in a browser) - platform.ts says what each value means; metro.config.js picks this file for OKEDGE_SHELL=webapp */
import type {DesktopBridge, Shell} from './platform.types';

/* the desktop window's preload is here: this is the web app's build in the desktop - the wrong one (npm run build:desktop) */
if ((globalThis as any).okedge) throw new Error('ok-edge: the web app build was loaded in the desktop window - build it with npm run build:desktop');

export type {DesktopBridge, Shell} from './platform.types';
export const shell: Shell = 'webapp';
/* what it keeps lives in this browser's profile, not on the computer */
export const DEVICE_WORD: string = 'browser';
export const SHOW_SCROLLBARS: boolean = true;
export const desktop: DesktopBridge | null = null;
/* the phone's Bluetooth (keyboard, security key, automations) is on this platform */
export const BLUETOOTH_HERE: boolean = false;
/* a login kept for this browser session, and the page's update check at the splash (webSession.ts, webUpdate.ts) */
export const WEB_SESSION: boolean = true;
/* the key is asked nothing until Log in (the web app: useWebKey armWebKey) */
export const KEY_WAITS_FOR_LOGIN: boolean = true;
/* a soft key to choose at the PIN screen, beside a plugged-in hard key */
export const SOFT_KEY_HERE: boolean = false;
/* the hard key is reached through WebAuthn only (useWebKey): no USB listing, so "attached" is not known until it answers */
export const KEY_OVER_WEBAUTHN: boolean = true;
/* this is a page in a browser tab: its own site (location), a reload logs out, downloads offered, other tabs, a service worker */
export const BROWSER_PAGE: boolean = true;
/* the idle end (idleTimer.ts) runs here - the web app's only, for now (Brad's call for the phone and the desktop) */
export const IDLE_END_HERE: boolean = true;
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
export const SLOT_WRITE_HERE: boolean = false;
/* the local MCP for this computer's agents runs in this app (electron/desktop/localMcp.js) */
export const LOCAL_MCP_HERE: boolean = false;
/* Settings: what Preferences holds here */
export const PREFERENCES_WHAT: string = "Settings you can change back: the key's own preferences and the keyboard layout.";
/* the Edge tab's Agents card: where an agent's request comes from here */
export const AGENT_FROM: string = "an agent through the server (Sync tab, the Server panel)";
/* the test build's banner - the phone's says what adb could do with the debugging lock off */
export const TEST_BUILD_BANNER: string = "TEST BUILD - not a release";
/* a line under the Activity cards: how this platform reaches its other devices, where it needs saying */
export const ACTIVITY_NOTE: string | null = "The web app reaches its other devices through the server's room only.";
/* how this device is named to the others in its room (src/serverRoom.ts; the key in use is added there) */
export function deviceName(): string {
  const ua = String(globalThis.navigator?.userAgent ?? '');
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  return `${browser} web app`;
}
/* the computer's shared id and name (the desktop app's - platform.desktop.ts); this device keeps its own */
export async function computerDevice(): Promise<{id: string; name: string} | null> { return null; }
/* the login's reason, as the key's log keeps it: which browser, at which site */
export function loginReason(): string {
  const ua = String(globalThis.navigator?.userAgent ?? '');
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'a browser';
  const host = (globalThis as {location?: {host?: string}}).location?.host;
  return `log in: the web app in ${browser} at ${host ?? 'its site'}`;
}

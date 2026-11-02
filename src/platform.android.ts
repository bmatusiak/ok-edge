/* THE PHONE APP (React Native) - platform.ts says what each value means; Metro picks this file for Android */
import type {DesktopBridge, Shell} from './platform.types';

export type {DesktopBridge, Shell} from './platform.types';
export const shell: Shell = 'android';
export const DEVICE_WORD: string = 'device';
/* a finger swipes, and the page shows it moves: no bars */
export const SHOW_SCROLLBARS: boolean = false;
export const desktop: DesktopBridge | null = null;
/* the phone's Bluetooth (keyboard, security key, automations) is on this platform */
export const BLUETOOTH_HERE: boolean = true;
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
export const AUTOFILL_HERE: boolean = true;
/* unlock with biometrics (Android Keystore) */
export const BIOMETRICS_HERE: boolean = true;
/* the phone's own permissions, passkey provider and app capabilities (Preferences, This Key) */
export const PHONE_PERMISSIONS_HERE: boolean = true;
/* the native watchdog that says "Edge watching stopped" when the JS stops (its test button in testing mode) */
export const NATIVE_WATCHDOG_HERE: boolean = true;
/* the press chime is native (NativeOkEmu.chime) and the sheet's own sound is not played */
export const NATIVE_CHIME_HERE: boolean = true;
/* a key slot can be written: the vendor interface (not over WebAuthn) */
export const SLOT_WRITE_HERE: boolean = true;
/* the local MCP for this computer's agents runs in this app (electron/desktop/localMcp.js) */
export const LOCAL_MCP_HERE: boolean = false;
/* Settings: what Preferences holds here */
export const PREFERENCES_WHAT: string = "Settings you can change back: the key's own preferences, the keyboard layout, unlock with biometrics, and this phone's permissions and passkey provider.";
/* the Edge tab's Agents card: where an agent's request comes from here */
export const AGENT_FROM: string = "an agent you accepted in Agents (through your server, or a computer over Bluetooth)";
/* the test build's banner - the phone's says what adb could do with the debugging lock off */
export const TEST_BUILD_BANNER: string = "TEST BUILD - debugging lock OFF: with adb on, a computer could approve and press";
/* a line under the Activity cards: how this platform reaches its other devices, where it needs saying */
export const ACTIVITY_NOTE: string | null = null;
/* how this device is named to the others in its room (src/serverRoom.ts; the key in use is added there) */
export function deviceName(): string { return 'Phone'; }
/* the login's reason, as the key's log keeps it */
export function loginReason(): string { return 'log in: the phone app'; }

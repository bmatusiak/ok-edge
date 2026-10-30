/* THE WEB APP (the web build in a browser) - platform.ts says what each value means; Metro picks this file for web */
import type {DesktopBridge, Shell} from './platform.types';

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

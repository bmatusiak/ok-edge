/* THE PHONE APP (React Native) - platform.ts says what each value means; Metro picks this file for Android */
import type {DesktopBridge, Shell} from './platform.types';

export type {DesktopBridge, Shell} from './platform.types';
export const shell: Shell = 'android';
export const DEVICE_WORD: string = 'phone';
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
/* the test build's banner - the phone's says what adb could do with the debugging lock off */
export const TEST_BUILD_BANNER: string = "TEST BUILD - debugging lock OFF: with adb on, a computer could approve and press";
/* a line under the Activity cards: how this platform reaches its other devices, where it needs saying */
export const ACTIVITY_NOTE: string | null = null;

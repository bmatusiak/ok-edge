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

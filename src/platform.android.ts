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

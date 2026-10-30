/*
 * THE DESKTOP APP (the web build in an Electron window) - platform.ts says what each value means; the desktop build
 * (OKEDGE_SHELL=desktop, metro.config.js) picks this file before platform.web.ts.
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

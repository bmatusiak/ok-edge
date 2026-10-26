/**
 * THE ROOT ON ELECTRON AND THE WEB (the phone takes entry.android.ts).
 *
 *   electron  ok-rn's app (phoneRoot.ts), as on the phone - its native modules are the desktop's
 *             (src/desktop/specs, mapped in by metro.config.js; stage 4)
 *   web       the services screen (App.tsx) until stage 5 brings the browser its key transports
 */
import App from '../App';
import { shell } from './platform';
import { phoneRoot } from './phoneRoot';

export const root = shell === 'desktop' ? phoneRoot() : App;
export function registerMore(): void {}

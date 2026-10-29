/**
 * THE ROOT ON ELECTRON AND THE WEB (the phone takes entry.android.ts).
 *
 *   electron  ok-rn's app (mainRoot.ts), as on the phone - its native modules are the desktop's
 *             (src/desktop/specs, mapped in by metro.config.js; stage 4)
 *   web       the services screen (App.tsx) until stage 5 brings the browser its key transports
 */
import App from '../App';
import { shell } from './platform';
import { mainRoot } from './mainRoot';

/* the web app uses the desktop's elements and views (Brad, 2026-10-26); its key comes through WebAuthn (useWebKey) */
export const root = shell === 'desktop' || shell === 'webapp' ? mainRoot() : App;
export function registerMore(): void {}

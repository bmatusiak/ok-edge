/**
 * THE ROOT ON THE DESKTOP AND THE WEB (the phone takes entry.android.ts): the one app (mainRoot.ts), as on the phone.
 * The desktop's native modules are its own (src/desktop/specs, mapped in by metro.config.js); the web app's key comes
 * through WebAuthn (useWebKey). The stage-2 services screen (App.tsx, src/app.ts) is gone (PROPOSAL-rectify-ok-edge.md
 * R0): the app's one Rectify container is src/plugins/index.ts.
 */
import { mainRoot } from './mainRoot';

export const root = mainRoot();
export function registerMore(): void {}

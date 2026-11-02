/*
 * THE SEALED BOX OF THIS SHELL - the contract (secretsBox.webapp.ts: the page's IndexedDB key; secretsBox.desktop.ts: the
 * main process's safeStorage). Metro swaps in the build's own file (metro.config.js, OKEDGE_SHELL); what TypeScript sees
 * is the web app's, as platform.ts does, and the check below keeps the two files alike.
 */
import type * as Desktop from './secretsBox.desktop';
import type * as Web from './secretsBox.webapp';

export * from './secretsBox.webapp';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
export const SECRETS_BOX_FILES_AGREE: Same<typeof Desktop, typeof Web> = true;

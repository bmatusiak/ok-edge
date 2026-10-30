/*
 * WHERE THIS PAGE RUNS, BY THE KEY'S SITE (PROPOSAL-rectify-ok-edge.md R2). Only the desktop chooses its own origin - it
 * serves its page itself - so only siteOrigin.desktop.ts acts: it tells the main process the key's site, and the window
 * opens there (electron/main.js). The phone has no origin to choose, and the web app is wherever it was opened (the
 * Server panel says when that is not the key's site). This file is theirs, and the contract.
 */
import type * as Desktop from './siteOrigin.desktop';

/** The identity check read the key's site (null: it names none). */
export function keySiteRead(_site: string | null): void {}

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
export const SITE_ORIGIN_FILES_AGREE: Same<typeof Desktop, {keySiteRead: typeof keySiteRead; SITE_ORIGIN_FILES_AGREE: true}> = true;

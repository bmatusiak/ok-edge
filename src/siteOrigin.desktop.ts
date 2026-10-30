/*
 * THE DESKTOP OPENS ITS PAGE AT THE KEY'S SITE (siteOrigin.ts says why; electron/main.js does it): the key's site, read at
 * the identity check, goes to the main process; when it is not where the page runs, the window opens there once - and
 * from then on it starts there.
 */
import {desktop} from './platform';

/** The identity check read the key's site (null: it names none). */
export function keySiteRead(site: string | null): void {
  void desktop?.invoke('okedge:keySite', site).catch(() => {});
}

export const SITE_ORIGIN_FILES_AGREE = true as const;

/*
 * THIS DEVICE'S BUCKET, KEPT AS ROWS (Brad, 2026-10-29: "the webapp can have an encrypted backup for caching"; "making
 * reloads of the app even cheaper"; "i was thinking about indexedDB in the browser"). The same rows the server's sealed
 * copy keeps (lib bucket/src/sealedcopy.js): a keyed id, a keyed change tag and a sealed unit - under keys from this
 * device's own sealing secret, so what is stored is encrypted at rest, and a write is the changed units only.
 *
 * ONE PER PLATFORM, picked by the build (PROPOSAL-rectify-ok-edge.md rule 2): rows.android.ts (AsyncStorage) and
 * rows.webapp.ts (IndexedDB). This file is what TypeScript and Jest see (the web one), and the check that both export the
 * same names and types. The testnet's rows are apart from the live ones and named so Clear testnet removes them.
 */
import type * as Android from './rows.android';
import type * as Web from './rows.webapp';

export * from './rows.webapp';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
export const ROWS_FILES_AGREE: Same<typeof Android, typeof Web> = true;

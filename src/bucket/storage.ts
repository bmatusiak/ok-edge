/*
 * WHERE THIS PLATFORM KEEPS AN IDENTITY'S BUCKET - one file per platform, picked by the build (PROPOSAL-rectify-ok-edge.md
 * rule 2): storage.android.ts and storage.webapp.ts (sealed rows), storage.desktop.ts (the CLI's file, shared). Every
 * platform holds ONE bucket in memory (src/bucketStore.ts) and this only keeps it: no shell is asked anywhere else.
 * This file is what TypeScript and Jest see (the web one), and the check that every platform file agrees.
 */
import type * as Android from './storage.android';
import type * as Web from './storage.webapp';
import type * as Desktop from './storage.desktop';

export * from './storage.webapp';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
export const STORAGE_FILES_AGREE: [Same<typeof Android, typeof Web>, Same<typeof Desktop, typeof Web>] = [true, true];

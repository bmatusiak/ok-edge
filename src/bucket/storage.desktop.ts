/*
 * THE DESKTOP: the bucket kept opened in the CLI's folder (~/.onlykey-js/buckets/<net>/<id>.json, lib bucket/cli/home.js),
 * so the desktop app and the CLI share one bucket (Brad, 2026-10-24: "cli and desktop decrypt once, share same bucket
 * stored in filesystem"). storage.ts says what storage is.
 *
 * ONE BUCKET IN MEMORY, AS ON EVERY PLATFORM (PROPOSAL-rectify-ok-edge.md R1). The page used to send every read and every
 * write across to the main process, key by key, so the desktop alone had no bucket in memory - and nothing that works on
 * a bucket (a trade, the server's sealed copy) could run here. Now the page reads the file once into memory
 * (okedge:bucketRead), writes by handing its bucket back to be MERGED into the file inside its lock (okedge:bucketMergeIn:
 * the lib's merge with the store rules, newer wins - a write the CLI made meanwhile is never lost), and takes in what the
 * CLI wrote with refresh (the same merge, the other way).
 */
import * as bucketLib from 'node-onlykey-lib/bucket';
import {desktop} from '../platform';
import {currentNet} from '../net';
import {RULES} from '../bucketRules';
import type {BucketStorage, Bucket, Opened} from './storage.types';

export type {BucketStorage, Bucket, Opened} from './storage.types';

const invoke = (channel: string, ...args: unknown[]) => desktop!.invoke(channel, ...args);

/* the lib's shared-file storage (bucket/src/storage.js sharedFileStorage), its file side the main process's (lib bucket/cli/file-side.js) */
export const storage: BucketStorage = bucketLib.storage.sharedFileStorage({
  side: {
    has: (identity: string, net: string) => invoke('okedge:bucketHas', identity, net),
    read: (identity: string, net: string) => invoke('okedge:bucketRead', identity, net),
    keep: (identity: string, net: string, text: string) => invoke('okedge:bucketKeep', identity, net, text),
    mergeIn: (identity: string, net: string, text: string) => invoke('okedge:bucketMergeIn', identity, net, text),
  },
  net: currentNet,
  rules: RULES,
}) as BucketStorage;

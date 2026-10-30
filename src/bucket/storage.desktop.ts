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

function kept(identity: string, net: string, bucket: Bucket): Opened {
  let writes: Promise<unknown> = Promise.resolve();
  return {
    bucket,
    write() {
      const run = writes.then(() => invoke('okedge:bucketMergeIn', identity, net, bucketLib.serialize(bucket)));
      writes = run.catch(() => {});
      return run.then(() => {});
    },
    async refresh() {
      const text = (await invoke('okedge:bucketRead', identity, net)) as string | null;
      if (!text) return 0;
      const {bucket: merged, report} = bucketLib.merge(bucket, bucketLib.parse(text), {rules: RULES});
      bucket.stores = merged.stores;
      /* the clock moves past every stamp taken in (lib merge), so this page's next write is later than all of them */
      (bucket as {clock?: unknown}).clock = (merged as {clock?: unknown}).clock;
      return Object.values(report.taken as Record<string, number>).reduce((a, b) => a + b, 0);
    },
  };
}

export const storage: BucketStorage = {
  needsKey: false,
  async state(identity) {
    return (await invoke('okedge:bucketHas', identity, currentNet())) ? 'kept' : 'none';
  },
  async open(identity) {
    const net = currentNet();
    const text = (await invoke('okedge:bucketRead', identity, net)) as string | null;
    return text ? kept(identity, net, bucketLib.parse(text)) : null;
  },
  async create(identity) {
    const net = currentNet();
    const bucket = bucketLib.create({owner: identity});
    await invoke('okedge:bucketKeep', identity, net, bucketLib.serialize(bucket));
    return kept(identity, net, bucket);
  },
};

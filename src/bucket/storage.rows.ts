/*
 * THE BUCKET KEPT AS SEALED ROWS - the phone's and the web app's storage (storage.android.ts, storage.webapp.ts): the rows
 * themselves are this platform's (rows.android.ts: AsyncStorage, rows.webapp.ts: IndexedDB). Opened with the key's secret;
 * every write puts only the units that changed, each sealed under keys from that secret, and the owner row once - a
 * write of one record is one row, and needs no key and no press.
 */
import * as bucketLib from 'node-onlykey-lib/bucket';
import {RULES} from '../bucketRules';
import {rowStore} from './rows';
import type {BucketStorage, Bucket, Opened} from './storage.types';

const randomBytes = (n: number): Uint8Array => crypto.getRandomValues(new Uint8Array(n));

function kept(identity: string, bucket: Bucket, key: Uint8Array, tags: Record<string, string>): Opened {
  const rows = rowStore(identity);
  const keys = bucketLib.sealedCopy.keysOf({secretKey: key});
  /* one write at a time, so the last stored is the newest bucket (writes arrive back to back) */
  let writes: Promise<unknown> = Promise.resolve();
  return {
    bucket,
    write() {
      const run = writes.then(async () => {
        const t = bucketLib.sealedCopy.table(bucket, keys, {rules: RULES});
        const ids = Object.keys(t.rows).filter(id => tags[id] !== t.rows[id]);
        const out: Record<string, {tag: string; blob: string}> = ids.length ? bucketLib.sealedCopy.sealRows(bucket, keys, ids, {rules: RULES, randomBytes}) : {};
        const o = bucketLib.sealedCopy.sealOwner(identity, keys, randomBytes);
        if (tags[o.id] !== o.tag) out[o.id] = {tag: o.tag, blob: o.blob};
        if (!Object.keys(out).length) return;
        await rows.put(out);
        for (const [id, r] of Object.entries(out)) tags[id] = r.tag;
      });
      writes = run.catch(() => {});
      return run;
    },
    /* nothing else writes these rows: what is in memory is what is kept */
    refresh: async () => 0,
  };
}

export const rowsStorage: BucketStorage = {
  needsKey: true,
  async state(identity) {
    return Object.keys(await rowStore(identity).table()).length ? 'sealed' : 'none';
  },
  async open(identity, key, prove) {
    if (!key) throw new Error('the bucket is sealed here: the key\'s secret opens it');
    const rows = rowStore(identity);
    const all = await rows.all();
    if (!Object.keys(all).length) return null;
    const bucket = prove(all);
    return kept(identity, bucket, key, await rows.table());
  },
  async create(identity, key) {
    if (!key) throw new Error('the bucket is sealed here: a new one needs the key\'s secret');
    const bucket = bucketLib.create({owner: identity});
    const opened = kept(identity, bucket, key, {});
    await opened.write();
    return opened;
  },
};

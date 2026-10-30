import type * as bucketLib from 'node-onlykey-lib/bucket';

export type Bucket = ReturnType<typeof bucketLib.create>;

/** An opened bucket: the bucket in memory, and how this platform keeps it. */
export type Opened = {
  bucket: Bucket;
  /** persist what changed in `bucket` (rows: the changed units; the desktop's file: merged in, newer wins) */
  write(): Promise<void>;
  /** take in what another program wrote meanwhile (the desktop's file, shared with the CLI): records taken, newer wins */
  refresh(): Promise<number>;
};

/**
 * Where this platform keeps an identity's bucket (storage.ts: one file per platform).
 *   needsKey   the bucket is sealed here and the key's secret opens it (rows); false where it is kept opened (the
 *              desktop's file, shared with the CLI - the CLI reads and writes it with no key)
 *   state      what opening takes: kept (no key), sealed (the key's secret), none (nothing kept yet)
 *   open       the bucket kept here; `prove` turns sealed rows into the bucket, proving the key is the identity's
 *   create     a new, empty bucket for the identity, kept from now on
 */
export type BucketStorage = {
  needsKey: boolean;
  state(identity: string): Promise<'kept' | 'sealed' | 'none'>;
  open(identity: string, key: Uint8Array | null, prove: (rows: Record<string, string>) => Bucket): Promise<Opened | null>;
  create(identity: string, key: Uint8Array | null): Promise<Opened>;
};

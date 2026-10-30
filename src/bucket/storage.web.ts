/*
 * THE WEB APP: the bucket kept as sealed rows in IndexedDB (storage.rows.ts, rows.web.ts) - it never holds an opened
 * bucket at rest (Brad, 2026-10-24: "webapp always has an encrypted bucket"). storage.ts says what storage is.
 */
export type {BucketStorage, Bucket, Opened} from './storage.types';
export {rowsStorage as storage} from './storage.rows';

/* THE PHONE: the bucket kept as sealed rows in AsyncStorage (storage.rows.ts, rows.android.ts) - storage.ts says what storage is */
export type {BucketStorage, Bucket, Opened} from './storage.types';
export {rowsStorage as storage} from './storage.rows';

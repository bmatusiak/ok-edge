/*
 * THE BUCKET KEPT AS SEALED ROWS - the phone's and the web app's storage (storage.android.ts, storage.webapp.ts): the lib's
 * rowsStorage (node-onlykey-lib bucket/src/storage.js - tested for every host in its matrix), over this platform's rows
 * (rows.android.ts: AsyncStorage, rows.webapp.ts: IndexedDB). Opened with the key's secret; every write puts only the
 * units that changed, each sealed, and the owner row once - a write of one record is one row, no key and no press.
 */
import * as bucketLib from 'node-onlykey-lib/bucket';
import {RULES} from '../bucketRules';
import {rowStore} from './rows';
import type {BucketStorage} from './storage.types';

const randomBytes = (n: number): Uint8Array => crypto.getRandomValues(new Uint8Array(n));

export const rowsStorage: BucketStorage = bucketLib.storage.rowsStorage({rows: rowStore, rules: RULES, randomBytes}) as BucketStorage;

/*
 * THE WEB APP'S ROWS: IndexedDB - no 5 MB ceiling (localStorage's), the rows of every identity in one database. rows.ts
 * says what a row store is. (The desktop keeps its bucket in the CLI's file - storage.desktop.ts - not in rows.)
 */
import {currentNet} from '../net';
import type {RowStore} from './rows.types';

export type {RowStore} from './rows.types';

declare const indexedDB: any;
const DB = 'okedge-rows';
const STORE = 'rows';
let dbP: Promise<any> | null = null;
function db(): Promise<any> {
  if (!dbP) {
    dbP = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { dbP = null; reject(req.error); };
    });
  }
  return dbP;
}
const done = (req: any): Promise<any> => new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
/* every [key, value] under one prefix, in key order */
async function scan(prefix: string): Promise<[string, {tag: string; blob: string}][]> {
  const tx = (await db()).transaction(STORE, 'readonly');
  const range = (globalThis as any).IDBKeyRange.bound(prefix, `${prefix}￿`);
  const [keys, values] = await Promise.all([done(tx.objectStore(STORE).getAllKeys(range)), done(tx.objectStore(STORE).getAll(range))]);
  return (keys as string[]).map((k, i) => [k, values[i]]);
}

function indexedRows(prefix: string): RowStore {
  return {
    async table() { return Object.fromEntries((await scan(prefix)).map(([k, v]) => [k.slice(prefix.length), v.tag])); },
    async all() { return Object.fromEntries((await scan(prefix)).map(([k, v]) => [k.slice(prefix.length), v.blob])); },
    async get(ids) {
      const s = (await db()).transaction(STORE, 'readonly').objectStore(STORE);
      const out: Record<string, string> = {};
      for (const id of ids) { const v = await done(s.get(prefix + id)); if (v) out[id] = v.blob; }
      return out;
    },
    async put(rows) {
      const tx = (await db()).transaction(STORE, 'readwrite');
      for (const [id, r] of Object.entries(rows)) tx.objectStore(STORE).put({tag: r.tag, blob: r.blob}, prefix + id);
      await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    },
    async clear() {
      const tx = (await db()).transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete((globalThis as any).IDBKeyRange.bound(prefix, `${prefix}￿`));
      await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    },
  };
}

/** This identity's rows in this browser, on the current net. */
export function rowStore(identity: string): RowStore {
  return indexedRows(`${currentNet() === 'test' ? 'test' : 'live'}:${identity.toLowerCase()}:`);
}

/** Clear testnet (testnet.ts): the web app's testnet rows. */
export async function clearTestRows(): Promise<void> {
  await indexedRows('test:').clear();
}

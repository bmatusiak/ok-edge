/*
 * THIS DEVICE'S BUCKET, KEPT AS ROWS (Brad, 2026-10-29: "the webapp can have an encrypted backup for caching"; "making
 * reloads of the app even cheaper"; "i was thinking about indexedDB in the browser"). The same rows the server's sealed
 * copy keeps (lib bucket/src/sealedcopy.js): a keyed id, a keyed change tag and a sealed unit - here under keys from this
 * device's own sealing secret (bucketStore.ts), so what is stored is encrypted at rest, and a write is the changed units
 * only, not the whole bucket sealed again.
 *
 * ONE STORE, TWO ADAPTERS (one code path, the difference in the adapter):
 *   the web app   IndexedDB - no 5 MB ceiling (localStorage's), the rows of every identity in one database
 *   the phone     AsyncStorage, a key per row (Android keeps it in SQLite)
 * The testnet's rows are apart from the live ones and named so Clear testnet removes them (testnet.ts).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {currentNet} from './net';
import {shell} from './platform';

export type RowStore = {
  /* id -> tag, the change table */
  table(): Promise<Record<string, string>>;
  get(ids: string[]): Promise<Record<string, string>>;
  put(rows: Record<string, {tag: string; blob: string}>): Promise<void>;
  /* id -> blob, every row */
  all(): Promise<Record<string, string>>;
  clear(): Promise<void>;
};

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

function asyncRows(prefix: string): RowStore {
  const mine = async () => (await AsyncStorage.getAllKeys()).filter(k => k.startsWith(prefix));
  const read = async (keys: string[]) => Object.entries(await AsyncStorage.getMany(keys)).filter(([, v]) => v).map(([k, v]) => [k.slice(prefix.length), JSON.parse(v as string)] as [string, {tag: string; blob: string}]);
  return {
    async table() { return Object.fromEntries((await read(await mine())).map(([id, v]) => [id, v.tag])); },
    async all() { return Object.fromEntries((await read(await mine())).map(([id, v]) => [id, v.blob])); },
    async get(ids) { return Object.fromEntries((await read(ids.map(id => prefix + id))).map(([id, v]) => [id, v.blob])); },
    async put(rows) { for (const [id, r] of Object.entries(rows)) await AsyncStorage.setItem(prefix + id, JSON.stringify({tag: r.tag, blob: r.blob})); },
    async clear() { for (const k of await mine()) await AsyncStorage.removeItem(k); },
  };
}

/** This identity's rows on this device, on the current net. */
export function rowCache(identity: string): RowStore {
  const test = currentNet() === 'test';
  if (shell === 'webapp' && typeof indexedDB !== 'undefined') return indexedRows(`${test ? 'test' : 'live'}:${identity.toLowerCase()}:`);
  return asyncRows(`okrn.rows.${test ? 'test.' : ''}${identity.toLowerCase()}.`);
}

/** Clear testnet (testnet.ts): the web app's testnet rows too - the phone's are AsyncStorage keys it already clears. */
export async function clearTestRows(): Promise<void> {
  if (shell !== 'webapp' || typeof indexedDB === 'undefined') return;
  await indexedRows('test:').clear();
}

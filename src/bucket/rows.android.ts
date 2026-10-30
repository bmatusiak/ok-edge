/* THE PHONE'S ROWS: AsyncStorage, a key per row (Android keeps it in SQLite) - rows.ts says what a row store is */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {currentNet} from '../net';
import type {RowStore} from './rows.types';

export type {RowStore} from './rows.types';

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
export function rowStore(identity: string): RowStore {
  return asyncRows(`okrn.rows.${currentNet() === 'test' ? 'test.' : ''}${identity.toLowerCase()}.`);
}

/* Clear testnet (testnet.ts): the phone's testnet rows are AsyncStorage keys (okrn.rows.test.*) it already clears */
export async function clearTestRows(): Promise<void> {}

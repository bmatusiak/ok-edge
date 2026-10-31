/*
 * WHAT THE APP KEEPS, FOR A DRIVE'S HEALTH CHECK (drive debugging #7): the web shells' storage - localStorage's keys and
 * their sizes, and the IndexedDB databases by name. A value is measured, never sent. storage.android.ts: AsyncStorage.
 */
export type StoredKey = {key: string; bytes: number};

export async function storedKeys(): Promise<{keys: StoredKey[]; databases: string[]}> {
  const keys: StoredKey[] = [];
  try {
    const ls = (globalThis as any).localStorage;
    for (let i = 0; ls && i < ls.length; i++) {
      const key = ls.key(i);
      if (key != null) keys.push({key, bytes: (ls.getItem(key) ?? '').length});
    }
  } catch { /* no localStorage: a page without one */ }
  let databases: string[] = [];
  try {
    const idb = (globalThis as any).indexedDB;
    if (idb?.databases) databases = (await idb.databases()).map((d: {name?: string}) => d.name ?? '?');
  } catch { /* not listed by this browser */ }
  return {keys, databases};
}

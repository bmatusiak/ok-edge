/* WHAT THE ANDROID APP KEEPS (storage.ts): AsyncStorage's keys and the size of each value - measured, never sent */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type StoredKey = {key: string; bytes: number};

export async function storedKeys(): Promise<{keys: StoredKey[]; databases: string[]}> {
  const names = await AsyncStorage.getAllKeys();
  const keys: StoredKey[] = [];
  /* in slices: one read of every key at once can pass the bridge's limit on a full store (AsyncStorage 3: getMany) */
  for (let i = 0; i < names.length; i += 50) {
    const got = await AsyncStorage.getMany(names.slice(i, i + 50));
    for (const [key, value] of Object.entries(got)) keys.push({key, bytes: (value ?? '').length});
  }
  return {keys, databases: []};
}

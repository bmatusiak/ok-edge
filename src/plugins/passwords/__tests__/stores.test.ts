/*
 * The store rules of src/plugins/passwords/stores.ts, against a fake key: its derive_secret is a
 * hash of its seed, the mode and the label, and it says whether it asked the person (the code).
 */
import {sha256} from 'node-onlykey-lib/vendor/@noble/hashes/sha2.js';
import {createStores, type Okcrypto} from '../stores';

const sha = (...parts: string[]) => sha256(Uint8Array.from(parts.join('|'), c => c.charCodeAt(0)));
/* tests only: distinct bytes are all the seal needs here */
const randomBytes = (n: number) => Uint8Array.from({length: n}, () => Math.floor(Math.random() * 256));
const ID = 'ab12cd34';

/* asks: the key's derive setting asks the code before a touchless derive (field 30 at its default) */
function fakeKey(seed: string, asks = false) {
  const calls: string[] = [];
  const okcrypto: Okcrypto = {
    async deriveSecret(label, opts = {}) {
      calls.push(label);
      if (asks) opts.confirm?.({digits: [1, 2, 3]});
      return sha(seed, 'touchless', label);
    },
  };
  return {okcrypto, calls};
}

function memory() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: async (k: string) => map.get(k) ?? null,
    setItem: async (k: string, v: string) => void map.set(k, v),
    removeItem: async (k: string) => void map.delete(k),
  };
}

test('a store not opened yet waits for the button; the button opens it with the store key, under the identity', async () => {
  const storage = memory();
  const stores = createStores({storage, randomBytes});
  const k = fakeKey('A');
  expect(await stores.tryOpen('embedded', k.okcrypto, ID)).toBeNull();
  expect(k.calls).toEqual([]);
  const r = await stores.openWithKey('embedded', k.okcrypto, ID);
  expect(r.why).toBe('by-itself');
  expect(k.calls).toEqual([`okedge/passwords/v1/${ID}/list`]);
  await r.manager.put({kind: 'login', title: 'Mail-title-x', username: 'u'});
  /* the records are the identity's, sealed: no label in the clear */
  expect([...storage.map.keys()].every(key => key.startsWith(`${ID}/`))).toBe(true);
  expect([...storage.map.values()].join('').includes('Mail-title-x')).toBe(false);
});

test('a store whose last open asked nothing opens by itself; one that asked waits for the button', async () => {
  const storage = memory();
  const quiet = createStores({storage, randomBytes});
  await quiet.openWithKey('embedded', fakeKey('A').okcrypto, ID);
  const again = createStores({storage, randomBytes});
  expect((await again.tryOpen('embedded', fakeKey('A').okcrypto, ID))?.why).toBe('by-itself');

  const storage2 = memory();
  const asking = createStores({storage: storage2, randomBytes});
  const shown: unknown[] = [];
  const r = await asking.openWithKey('embedded', fakeKey('A', true).okcrypto, ID, a => shown.push(a));
  expect(r.why).toBe('asked');
  expect(shown).toEqual([{digits: [1, 2, 3]}]);
  const later = createStores({storage: storage2, randomBytes});
  const k = fakeKey('A', true);
  expect(await later.tryOpen('embedded', k.okcrypto, ID)).toBeNull();
  expect(k.calls).toEqual([]);
});

test('another key (other seeds) opens nothing of this store: every record refused', async () => {
  const storage = memory();
  const a = createStores({storage, randomBytes});
  const m = (await a.openWithKey('embedded', fakeKey('A').okcrypto, ID)).manager;
  await m.put({kind: 'login', title: 'Bank', username: 'u'});
  const b = createStores({storage, randomBytes});
  const other = (await b.openWithKey('usb', fakeKey('B').okcrypto, ID)).manager;
  expect(other.size).toBe(0);
  expect(other.refused().map(r => r.reason)).toEqual(['does-not-open']);
});

test('two keys of one backup share one open store; it closes when the last one goes, and Lock closes it for both', async () => {
  const stores = createStores({storage: memory(), randomBytes});
  const soft = await stores.openWithKey('embedded', fakeKey('A').okcrypto, ID);
  const hard = fakeKey('A');
  const shared = await stores.tryOpen('usb', hard.okcrypto, ID);
  expect(shared?.manager).toBe(soft.manager);
  expect(hard.calls).toEqual([]);
  stores.close('embedded');
  expect(stores.current('usb')).toBe(soft.manager);
  stores.close('usb');
  expect(stores.openCount()).toBe(0);
  expect(soft.manager.locked).toBe(true);

  const again = await stores.openWithKey('embedded', fakeKey('A').okcrypto, ID);
  await stores.tryOpen('usb', fakeKey('A').okcrypto, ID);
  stores.lockNow('usb');
  expect(stores.openCount()).toBe(0);
  expect(again.manager.locked).toBe(true);
});

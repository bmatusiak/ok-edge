/**
 * NativeSecrets' sealed box in the web app: the phone's KeystoreBox and the desktop's safeStorage box
 * (electron/desktop/secrets.js), with what a browser has. The page has no OS keychain, so the box key is
 * a WebCrypto AES-256-GCM key made NON-EXTRACTABLE and kept in IndexedDB: the page can seal and open
 * with it but no script can read its bytes out, and it never leaves this browser profile. Weaker than
 * the OS keychain (anyone with this profile's files and this site's origin can use it), which is why
 * nothing sealed here is more than this browser's own copy of what the key and the bucket already hold.
 *
 * Sealed text is the desktop's: hex of iv (12) | tag (16) | ciphertext. Forgetting an alias deletes its
 * key, so everything sealed under it stays sealed.
 */
const DB = 'okedge-box';
const STORE = 'keys';

const fromHex = (h: string) => Uint8Array.from(h.match(/../g) || [], (x) => parseInt(x, 16));
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

/* one IndexedDB request on the key store, answered as a Promise */
async function run<T>(mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const d = await db();
  try {
    return await new Promise<T>((resolve, reject) => {
      const r = op(d.transaction(STORE, mode).objectStore(STORE));
      r.onsuccess = () => resolve(r.result as T);
      r.onerror = () => reject(r.error);
    });
  } finally {
    d.close();
  }
}

function checkAlias(alias: string) {
  /* the desktop's rule, so an alias that works on one shell works on the others */
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(alias)) throw new Error(`a box alias is letters, digits and . _ -; got "${alias}"`);
}

async function keyOf(alias: string, { create }: { create: boolean }): Promise<CryptoKey> {
  checkAlias(alias);
  const have = await run<CryptoKey | undefined>('readonly', (s) => s.get(alias));
  if (have) return have;
  if (!create) throw new Error(`no box key "${alias}" - it was forgotten, or never made`);
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  await run('readwrite', (s) => s.put(key, alias));
  return key;
}

export async function boxSeal(alias: string, plainHex: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  /* WebCrypto gives ciphertext | tag; the box stores iv | tag | ciphertext */
  const out = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyOf(alias, { create: true }), fromHex(plainHex)));
  const tag = out.subarray(out.length - 16);
  const ct = out.subarray(0, out.length - 16);
  return hex(iv) + hex(tag) + hex(ct);
}

export async function boxOpen(alias: string, sealedHex: string): Promise<string> {
  const b = fromHex(sealedHex);
  const joined = new Uint8Array(b.length - 12);
  joined.set(b.subarray(28), 0);
  joined.set(b.subarray(12, 28), b.length - 28);
  return hex(new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.subarray(0, 12) }, await keyOf(alias, { create: false }), joined)));
}

export async function boxForget(alias: string): Promise<boolean> {
  checkAlias(alias);
  const had = await run<CryptoKey | undefined>('readonly', (s) => s.get(alias));
  if (!had) return false;
  await run('readwrite', (s) => s.delete(alias));
  return true;
}

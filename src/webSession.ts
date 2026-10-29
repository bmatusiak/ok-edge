/*
 * STAY LOGGED IN WHEN THE PAGE RELOADS (Brad, 2026-10-29: "staying logged in across a reload with sessionStorage
 * (optional for the user)"; asked at login: "yes, that is a better idea"). The web app only, and only when the person
 * chooses it at the identity check ("Stay logged in on this tab") - each login asks again.
 *
 * A reload is a new page: what the login opened - the bucket's secret, derived by the key with the login's press - is
 * gone, and logging in again is another press. Chosen at the login, the tab keeps that secret for the next load of THIS tab:
 *   - encrypted (AES-GCM) under a browser key made for this tab that cannot be exported (WebCrypto, non-extractable),
 *     kept in IndexedDB - the secret itself is never in plain storage;
 *   - sessionStorage holds which identity, the encrypted secret and the reference to that browser key - sessionStorage is
 *     this tab's alone and ends with it;
 *   - until the browser exits (Brad, 2026-10-29: "stay authenticated until browser exit"): sessionStorage outlives every
 *     reload of the tab and ends when the tab or the browser closes - no time limit of its own. (A browser set to
 *     restore its last session restores sessionStorage with it: that is still the same browser session.)
 * A load that finds it still reads the key (no press): it must be present, unlocked and the same identity, and the
 * secret must open the rows this device keeps (bucketStore) - else it is dropped and the login asks as always. No login
 * link is written to Edge then: no login happened. It ends with Log out, a lock or an unplug (the door closing), another
 * key.
 */
import {bytes as okbytes} from 'node-onlykey-lib';
import {shell} from './platform';

declare const sessionStorage: any;
declare const indexedDB: any;

const SESSION = 'okedge-session';
const web = shell === 'webapp' && typeof sessionStorage !== 'undefined' && typeof indexedDB !== 'undefined' && !!globalThis.crypto?.subtle;

type Kept = {identity: string; net: string; ref: string; iv: string; ct: string};

/** Can this host keep a login across a reload at all (the web app, with WebCrypto, IndexedDB and sessionStorage)? */
export const canKeepSession = web;


/* the tab's browser keys, by reference: one IndexedDB store of CryptoKey objects (structured clone keeps them unexportable) */
let dbP: Promise<any> | null = null;
function db(): Promise<any> {
  if (!dbP) dbP = new Promise((resolve, reject) => {
    const req = indexedDB.open('okedge-session', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('keys');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { dbP = null; reject(req.error); };
  });
  return dbP;
}
const done = (req: any): Promise<any> => new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
async function keyStore(mode: 'readonly' | 'readwrite') { return (await db()).transaction('keys', mode).objectStore('keys'); }

function read(): Kept | null {
  try { const k = JSON.parse(sessionStorage.getItem(SESSION) || 'null'); return k && typeof k.ct === 'string' ? k : null; } catch { return null; }
}

/** A kept login for this tab - which identity and net (no key asked, nothing opened). */
export function keptSession(): {identity: string; net: string} | null {
  if (!web) return null;
  const k = read();
  return k ? {identity: k.identity, net: k.net} : null;
}

/** After a login opened the bucket, the person having chosen to stay logged in: keep its secret for this tab's next load. */
export async function keepSession(identity: string, net: string, secret: Uint8Array): Promise<void> {
  if (!web) return;
  const subtle = globalThis.crypto.subtle;
  const key = await subtle.generateKey({name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']);
  const ref = okbytes.toHex(globalThis.crypto.getRandomValues(new Uint8Array(16)));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await subtle.encrypt({name: 'AES-GCM', iv}, key, Uint8Array.from(secret)));
  await done((await keyStore('readwrite')).put(key, ref));
  const was = read();
  sessionStorage.setItem(SESSION, JSON.stringify({identity, net, ref, iv: okbytes.toHex(iv), ct: okbytes.toHex(ct)}));
  if (was && was.ref !== ref) await done((await keyStore('readwrite')).delete(was.ref)).catch(() => undefined);
  console.log(`[session] this tab stays authenticated for ${identity.slice(0, 12)} - until the browser exits`);
}

/** The kept secret for this identity and net, or null (none, run out, another identity, or it does not decrypt). */
export async function takeSession(identity: string, net: string): Promise<Uint8Array | null> {
  const k = keptSession() && read();
  if (!k) return null;
  if (k.identity !== identity.toLowerCase() || k.net !== net) { await endSession('another identity on the key'); return null; }
  try {
    const key = await done((await keyStore('readonly')).get(k.ref));
    if (!key) throw new Error('its browser key is gone');
    return new Uint8Array(await globalThis.crypto.subtle.decrypt({name: 'AES-GCM', iv: okbytes.fromHex(k.iv)}, key, okbytes.fromHex(k.ct)));
  } catch (e) {
    await endSession(`it did not open (${String((e as Error)?.message ?? e)})`);
    return null;
  }
}

/** Ends this tab's kept login: Log out, the door closing, another key. */
export async function endSession(why: string): Promise<void> {
  if (!web) return;
  const k = read();
  try { sessionStorage.removeItem(SESSION); } catch { /* no storage */ }
  if (!k) return;
  await done((await keyStore('readwrite')).delete(k.ref)).catch(() => undefined);
  console.log(`[session] this tab's kept login ended - ${why}`);
}

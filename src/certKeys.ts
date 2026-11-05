/*
 * AN RSA KEY NAMED BY ITS CERTIFICATE (Brad, 2026-11-04: "we upload the pubcert as the label to select RSA3"; "the ai does
 * not need to know the slot"). An agent's card asks for RSA keys by their X.509 certificates (lib mcp.js card_new certs),
 * and its plan items name one by the certificate's SHA-256. This device turns a certificate into the slot that holds its
 * key: the owner's Key Chain first (the list in the bucket - no key request), else the key's own RSA1-4 public keys (reads,
 * no press). Approving the card keeps the certificate on that slot's Key Chain entry, so it is in the bucket - for the next
 * plan's lookup, and for recovery.
 */
import {keychainList, saveKeyChainList} from './keyChainRecorder';
import {getOnlyKey} from './onlykey';
import {activeBackend} from './hooks/KeyContext';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const keychain = require('node-onlykey-lib/keychain');

export type CertKey = {slot: number; bits: number; sha256: string; pem: string; subject: Record<string, string>; notAfter: string; publicKey: Uint8Array};

const RSA_SLOTS = [1, 2, 3, 4];
const hexOf = (b: Uint8Array) => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');

async function entries(): Promise<any[]> {
  try {
    const raw = await keychainList.getItem('list');
    return raw ? keychain.list.parse(raw) : [];
  } catch {
    return [];
  }
}

/** The slot whose key this certificate certifies - Key Chain first, then the key's RSA slots. Throws when none is. */
export async function slotOfCert(pem: string): Promise<CertKey> {
  const c = keychain.x509.read(pem);
  const want = hexOf(c.modulus);
  const base = {bits: c.bits, sha256: c.sha256, pem: pem.trim(), subject: c.subject, notAfter: c.notAfter, publicKey: c.modulus};
  const kept = (await entries()).find(e => e.kind === 'slot' && e.type === 'rsa' && hexOf(e.publicKey) === want);
  if (kept && RSA_SLOTS.includes(kept.slot)) return {...base, slot: kept.slot};
  const {device} = await getOnlyKey(activeBackend());
  for (const slot of RSA_SLOTS) {
    const p = await device.probeKeySlot(slot).catch(() => null);
    if (p?.kind === 'rsa' && p.publicKey && hexOf(p.publicKey) === want) return {...base, slot};
  }
  throw new Error(`the certificate "${c.subject.CN || c.sha256.slice(0, 16)}" is for a key in none of this OnlyKey's RSA slots`);
}

/** The slot of a certificate the Key Chain keeps, by its SHA-256 (a plan item's key.cert) - null when none is kept. */
export async function slotOfCertHash(sha256: string): Promise<CertKey | null> {
  for (const e of await entries()) {
    if (e.kind !== 'slot' || e.type !== 'rsa' || !e.x509) continue;
    const c = keychain.x509.read(e.x509);
    if (c.sha256 === sha256.toLowerCase() && RSA_SLOTS.includes(e.slot)) {
      return {slot: e.slot, bits: c.bits, sha256: c.sha256, pem: e.x509, subject: c.subject, notAfter: c.notAfter, publicKey: c.modulus};
    }
  }
  return null;
}

/*
 * ITS SIGNATURE, where the page has WebCrypto (the desktop, the web app): a certificate signed by its own key, as one
 * made by `onlykey-js cert` is. 'unchecked' on a device without WebCrypto - said, not hidden; 'bad' refuses it.
 */
export async function signatureOf(pem: string): Promise<'checked' | 'unchecked' | 'bad'> {
  const subtle = (globalThis as any).crypto?.subtle;
  if (!subtle) return 'unchecked';
  const c = keychain.x509.read(pem);
  /* RSA with SHA-1 (Android's debug certificate), -256, -384, -512; any other algorithm is not checked - never called bad */
  const hash = ({sha1WithRSAEncryption: 'SHA-1', sha256WithRSAEncryption: 'SHA-256', sha384WithRSAEncryption: 'SHA-384', sha512WithRSAEncryption: 'SHA-512'} as Record<string, string>)[c.signatureAlgorithm];
  if (!hash) return 'unchecked';
  const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...Array.from(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const key = await subtle.importKey('jwk', {kty: 'RSA', n: b64u(c.modulus), e: b64u(c.exponent), ext: true}, {name: 'RSASSA-PKCS1-v1_5', hash}, false, ['verify']);
  return (await subtle.verify('RSASSA-PKCS1-v1_5', key, c.signature, c.tbs)) ? 'checked' : 'bad';
}

/*
 * IMPORTED BY THE OWNER (Key Chain, On this App - Import certificate; Brad, 2026-11-05: "I was expecting it to be added to
 * On this App"): the slot its key is in, and its signature - both before anything is kept.
 */
export async function checkCert(pem: string): Promise<{key: CertKey; signature: 'checked' | 'unchecked'}> {
  const key = await slotOfCert(pem);
  const signature = await signatureOf(pem);
  if (signature === 'bad') throw new Error('this certificate\'s signature does not check out with its own key');
  return {key, signature};
}

/** The slot still holds this certificate's key: its public key read now (no press) is the certificate's. */
export async function certKeyStillIn(k: CertKey): Promise<boolean> {
  const {device} = await getOnlyKey(activeBackend());
  const p = await device.probeKeySlot(k.slot).catch(() => null);
  return p?.kind === 'rsa' && !!p.publicKey && hexOf(p.publicKey) === hexOf(k.publicKey);
}

/** Keep the certificate on its slot's Key Chain entry (merged with the entry that is there) - in the bucket. */
export async function keepCert(k: CertKey, name?: string): Promise<'saved' | 'held' | 'same'> {
  const made = keychain.list.createEntry({kind: 'slot', slot: k.slot, type: 'rsa', publicKey: k.publicKey, name: name || `RSA${k.slot}`, x509: k.pem});
  const r = await saveKeyChainList(cur => keychain.list.merge(cur, [made]).entries);
  return r.state;
}

/*
 * The key as Key Chain names it - the certificate's subject and its end ("ok-edge release, bmatusiak · until 2056-10-28"),
 * what the owner sees in On this App - then where it is and which it is: the slot, the size, the fingerprint (Brad,
 * 2026-11-05: the card should ask "use ok-edge release, bmatusiak · until 2056-10-28 for signing ok-edge").
 */
export function certName(k: Pick<CertKey, 'subject' | 'notAfter'>): string {
  const who = [k.subject.CN, k.subject.O].filter(Boolean).join(', ') || 'no name';
  return `${who} · until ${k.notAfter.slice(0, 10)}`;
}
export function certLine(k: CertKey): string {
  return `${certName(k)}  (RSA${k.slot} · RSA-${k.bits} · SHA-256 ${k.sha256.slice(0, 16).toUpperCase()}…)`;
}

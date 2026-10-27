/*
 * THE APP'S OWN ASK, RIGHT NOW (box/Pixel, 2026-10-25: opening this identity's bucket showed "an identity not in your
 * Key Chain - nobody listed it, if you did not ask for it, let it run out" - the app had asked). A feature that is
 * about to ask the key for a label notes it here; for a short while the sheet names it as this app's ask and drops
 * the warning. Only for that while: the same label asked by anything else later still gets the warning, so a
 * computer cannot borrow the bucket's label to look like the app.
 *
 * Its own module, imported by the asking features (the bucket, Passwords) and by pressAsk.ts, which re-exports it:
 * the bucket store must not import pressAsk (pressAsk -> keyChainRecorder -> bucketStore would be a cycle).
 */
const {okconnect} = require('node-onlykey-lib/crypto');
const {sha256} = require('node-onlykey-lib/vendor/@noble/hashes/sha2.js');

const OWN_ASK_MS = 30_000;
const ownAsks = new Map<string, {what: string; at: number}>();
const hex = (b: ArrayLike<number>) => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');

/** A derive or decrypt of this label (its derivation hash, as the firmware's record carries it). */
export function noteOwnAsk(label: string, what: string): void {
  ownAsks.set(hex(okconnect.derivationHash(label) as Uint8Array), {what, at: Date.now()});
}

/*
 * A derive_secret ask (okcrypto.deriveSecret): its gate's record carries [mode | SHA-256(label)] - the request's own
 * payload, cut to 32 bytes - not the derivation hash above, so it is noted in that shape. Mode: 1 touchless, 2 touch.
 */
export function noteOwnSecret(label: string, touch: boolean, what: string): void {
  const h: Uint8Array = sha256(Uint8Array.from(unescape(encodeURIComponent(label)), c => c.charCodeAt(0)));
  ownAsks.set(hex([touch ? 2 : 1, ...Array.from(h.subarray(0, 31))]), {what, at: Date.now()});
}

export function ownAskOf(labelHash: string, now = Date.now()): string | null {
  const a = ownAsks.get(labelHash.toLowerCase());
  return a && now - a.at < OWN_ASK_MS ? a.what : null;
}

/* PBKDF2-SHA256 in the page (WebCrypto), as the phone does natively (module.ts: how a desktop module is made) */
import type {Spec} from 'okedge-native/specs/NativeKdf';
import {desktopModule} from './module';
const fromHex = (h: string) => Uint8Array.from(h.match(/../g) || [], (x) => parseInt(x, 16));
const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join('');

export default desktopModule<Spec>('NativeKdf', {
  async pbkdf2Sha256(passwordHex: string, saltHex: string, iterations: number, dkLen: number) {
    /* the phone module's own limits (NativeKdfModule), with its words */
    if (Math.trunc(iterations) < 1 || Math.trunc(dkLen) < 1 || Math.trunc(dkLen) > 1024) {
      throw new Error('PBKDF2 needs at least one round and 1..1024 bytes');
    }
    const key = await globalThis.crypto.subtle.importKey('raw', fromHex(passwordHex), 'PBKDF2', false, ['deriveBits']);
    return hex(await globalThis.crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations }, key, dkLen * 8));
  },
});

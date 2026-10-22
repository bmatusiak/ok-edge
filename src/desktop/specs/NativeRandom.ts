/* the page's own CSPRNG (Chromium's crypto.getRandomValues) (module.ts: how a desktop module is made) */
import type {Spec} from 'okedge-native/specs/NativeRandom';
import {desktopModule} from './module';
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

export default desktopModule<Spec>('NativeRandom', {
  getRandomHex: (byteLength: number) => hex(globalThis.crypto.getRandomValues(new Uint8Array(byteLength))),
});

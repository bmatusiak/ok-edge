/* a fresh RSA key's primes from Electron's main process (Node's OpenSSL) (module.ts: how a desktop module is made) */
import type {Spec} from 'okedge-native/specs/NativeRsaGen';
import {desktopModule, invoke} from './module';
export default desktopModule<Spec>('NativeRsaGen', {
  generatePrimes: (bits: number, publicExponent: number) => invoke<string>('NativeRsaGen:generatePrimes', bits, publicExponent),
});

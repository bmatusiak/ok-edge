/* clipboard in the page, the sealed box in Electron's main process (safeStorage) or, in the web app, the page (webBox.ts); no biometrics on the desktop (module.ts: how a desktop module is made) */
import type {Spec} from 'okedge-native/specs/NativeSecrets';
import {desktopModule, invoke} from './module';
import {shell} from '../../platform';
import * as webBox from './webBox';
let clearTimer: ReturnType<typeof setTimeout> | null = null;

export default desktopModule<Spec>('NativeSecrets', {
  /* the clipboard: the page's own, cleared after the given time as the phone does */
  async copySensitive(text: string, clearAfterMs: number) {
    await navigator.clipboard.writeText(text);
    if (clearTimer) clearTimeout(clearTimer);
    if (clearAfterMs > 0) clearTimer = setTimeout(() => { navigator.clipboard.writeText('').catch(() => {}); }, clearAfterMs);
    return true;
  },
  async clearClipboard() { await navigator.clipboard.writeText(''); return true; },
  /* no screenshot block on a desktop window */
  async setScreenshotsBlocked() {},
  async screenshotsBlocked() { return false; },
  /*
   * No biometric prompt on the desktop, so no biometric store: it holds nothing, and answers as
   * the phone's does for an alias with nothing in it (src/biometrics.ts explains 'no-hardware').
   */
  async biometricStatus() { return 'no-hardware'; },
  async biometricHas() { return false; },
  async biometricForget() { return true; },
  async biometricLoad(alias: string) { throw new Error(`nothing is stored under "${alias}": this desktop has no biometric store`); },
  async biometricStore() { throw new Error('this desktop has no biometric store - nothing was stored'); },
  /*
   * The Keystore box: on the desktop Electron's safeStorage (the OS keychain/DPAPI), in the main process; in the
   * web app a non-extractable WebCrypto key in IndexedDB (webBox.ts says what that does and does not protect).
   */
  boxSeal: (alias: string, hex: string) => (shell === 'webapp' ? webBox.boxSeal(alias, hex) : invoke<string>('NativeSecrets:boxSeal', alias, hex)),
  boxOpen: (alias: string, hex: string) => (shell === 'webapp' ? webBox.boxOpen(alias, hex) : invoke<string>('NativeSecrets:boxOpen', alias, hex)),
  boxForget: (alias: string) => (shell === 'webapp' ? webBox.boxForget(alias) : invoke<boolean>('NativeSecrets:boxForget', alias)),
});

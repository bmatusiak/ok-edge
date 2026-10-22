/* clipboard in the page, the sealed box in Electron's main process (safeStorage); no biometrics on the desktop (module.ts: how a desktop module is made) */
import type {Spec} from 'okedge-native/specs/NativeSecrets';
import {desktopModule, invoke} from './module';
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
  /* no biometric prompt on the desktop: the biometric store is absent */
  async biometricStatus() { return 'unavailable'; },
  async biometricHas() { return false; },
  /* the Keystore box: Electron's safeStorage (the OS keychain/DPAPI), in the main process */
  boxSeal: (alias: string, hex: string) => invoke<string>('NativeSecrets:boxSeal', alias, hex),
  boxOpen: (alias: string, hex: string) => invoke<string>('NativeSecrets:boxOpen', alias, hex),
  boxForget: (alias: string) => invoke<boolean>('NativeSecrets:boxForget', alias),
});

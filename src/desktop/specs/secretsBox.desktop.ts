/* THE DESKTOP'S SEALED BOX: Electron's safeStorage (the OS keychain / DPAPI), in the main process */
import {invoke} from './module';

export const boxSeal = (alias: string, hex: string) => invoke<string>('NativeSecrets:boxSeal', alias, hex);
export const boxOpen = (alias: string, hex: string) => invoke<string>('NativeSecrets:boxOpen', alias, hex);
export const boxForget = (alias: string) => invoke<boolean>('NativeSecrets:boxForget', alias);

/* Android's credential provider (passkeys for Chrome on the phone): absent on the desktop (module.ts: how a desktop module is made) */
import type {Spec} from 'okedge-native/specs/NativeCredProvider';
import {desktopModule} from './module';
export default desktopModule<Spec>('NativeCredProvider', { isSupported: async () => false }, []);

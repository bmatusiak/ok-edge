/* the phone as a Bluetooth keyboard: the phone's own, absent on the desktop (module.ts: how a desktop module is made) */
import type {Spec} from 'okedge-native/specs/NativeBtKeyboard';
import {desktopModule} from './module';
export default desktopModule<Spec>('NativeBtKeyboard', { isSupported: async () => false }, ["onStatus"]);

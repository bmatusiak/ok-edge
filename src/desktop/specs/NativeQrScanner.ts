/* the camera's QR scanner: absent on the desktop (module.ts: how a desktop module is made) */
import type {Spec} from 'okedge-native/specs/NativeQrScanner';
import {desktopModule} from './module';
export default desktopModule<Spec>('NativeQrScanner', {}, []);

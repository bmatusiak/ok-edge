/* Android's share sheet and asset reads: not on the desktop yet (module.ts: how a desktop module is made) */
import type {Spec} from 'okedge-native/specs/NativeShare';
import {desktopModule} from './module';
export default desktopModule<Spec>('NativeShare', {}, []);

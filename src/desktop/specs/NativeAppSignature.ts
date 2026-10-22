/* the APK's signing certificate: there is no APK on the desktop (module.ts: how a desktop module is made) */
import type {Spec} from 'okedge-native/specs/NativeAppSignature';
import {desktopModule} from './module';
export default desktopModule<Spec>('NativeAppSignature', { isOfficial: () => false }, []);

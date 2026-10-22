/* the APK's signing certificate: there is no APK on the desktop (module.ts: how a desktop module is made) */
import type {Spec} from 'okedge-native/specs/NativeAppSignature';
import {desktopModule} from './module';
export default desktopModule<Spec>('NativeAppSignature', {
  isOfficial: () => false,
  /* no APK, so no signer: the app shows it as unofficial, as an unsigned build */
  signerSha256: () => '',
}, []);

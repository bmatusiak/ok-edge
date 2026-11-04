import {Platform} from 'react-native';
import NativeAppSignature from 'okedge-native/specs/NativeAppSignature';

/*
 * The APK's signer, read once at start (specs/NativeAppSignature.ts). `unofficial` drives the
 * UNOFFICIAL RELEASE banner; false when Android would not say or the module is missing (an APK
 * from before it), because the app cannot tell then - it does not guess.
 */
/*
 * THE DESKTOP AND THE WEB APP ARE ALWAYS AN UNOFFICIAL RELEASE (Brad, 2026-11-04: the app may carry the OnlyKey name
 * with OnlyKey's permission, "except the build must say unofficial release, like the banner i have in the source"):
 * there is no official OnlyKey signing for either, so there is nothing to check - both are web bundles (Platform 'web').
 */
const WEB_SHELL = Platform.OS === 'web';
function read(): {sha256: string; unofficial: boolean} {
  if (WEB_SHELL) return {sha256: '', unofficial: true};
  if (!NativeAppSignature) return {sha256: '', unofficial: false};
  try {
    const sha256 = NativeAppSignature.signerSha256();
    return {sha256, unofficial: sha256 !== '' && !NativeAppSignature.isOfficial()};
  } catch {
    return {sha256: '', unofficial: false};
  }
}

export const appSignature = read();

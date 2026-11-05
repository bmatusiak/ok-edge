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
/*
 * TWO DIFFERENT THINGS, NO LONGER ONE (Brad, 2026-11-05: "unofficial banner is a permanent banner and never goes away";
 * "if the apk is signed by debug keystore, it shows a banner"). UNOFFICIAL RELEASE is about the project - ok-edge is
 * not an OnlyKey product - and is said on every build (banners.tsx). This file answers only the phone's other question:
 * is this APK signed with the ok-edge release key (red-key's RSA3, signing/release.crt.pem)? `notReleaseSigned` is true
 * when Android names a signer and it is not that key - the debug keystore's APK, or one repackaged by someone else;
 * false where nothing is signed (the desktop, the web app) or the app cannot tell (it does not guess).
 */
const WEB_SHELL = Platform.OS === 'web';
function read(): {sha256: string; notReleaseSigned: boolean} {
  if (WEB_SHELL || !NativeAppSignature) return {sha256: '', notReleaseSigned: false};
  try {
    const sha256 = NativeAppSignature.signerSha256();
    return {sha256, notReleaseSigned: sha256 !== '' && !NativeAppSignature.isOfficial()};
  } catch {
    return {sha256: '', notReleaseSigned: false};
  }
}

export const appSignature = read();

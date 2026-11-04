package okedge.apksign;

import java.security.Provider;
import java.security.Security;

/**
 * THE APK SIGNED BY A KEY THAT NEVER LEAVES THE ONLYKEY (Brad, 2026-11-04: the release APK signed by red-key's "RSA3
 * Code Signing" slot). apksigner loads this as its keystore provider:
 *
 *   java -cp apksigner.jar:classes com.android.apksigner.ApkSignerTool sign --ks NONE --ks-type OKEDGE
 *     --ks-provider-class okedge.apksign.DeviceKeyProvider --ks-provider-arg cert.pem --ks-pass pass:none ...
 *
 * The private key is the slot's: this JVM never holds it, so it cannot sign as apksigner asks. It runs twice instead
 * (tools/release/apk-sign/sign.js), one mode a run:
 *
 *   RECORD (OKSIGN_RECORD = a file): every digest apksigner asks to have signed is written down, answered with a
 *     placeholder, and the output APK thrown away. apksig verifies each signature the moment it makes it; in this mode
 *     this provider goes FIRST (the JCA asks it before SunRsaSign) and that check passes - nothing it makes is kept.
 *   REPLAY (OKSIGN_REPLAY = a file of "digest signature" lines, hex): the same digests come again - the signed data is
 *     the APK's content digests and the certificate, nothing that changes between runs - and each is answered with the
 *     signature the key made for it. This provider goes LAST, so apksig's check runs on SunRsaSign against the
 *     certificate's public key: a signature from another key fails here, not at install.
 *
 * Between the two, sign.js asks the key over MCP - the fingerprints first, the owner's approval and one press, then
 * the digests (tools/release/apk-sign/sign.js).
 */
public final class DeviceKeyProvider extends Provider {

  private static final long serialVersionUID = 1L;

  public DeviceKeyProvider() {
    this(null);
  }

  public DeviceKeyProvider(String certPath) {
    super("OkEdgeDevice", "1.0", "ok-edge: an APK signed by an OnlyKey slot (KeyStore.OKEDGE, SHA256withRSA, SHA512withRSA)");
    if (certPath != null && !certPath.isEmpty()) DeviceKeyStore.setCertPath(certPath);
    put("KeyStore.OKEDGE", DeviceKeyStore.class.getName());
    put("Signature.SHA256withRSA", DeviceSignature.Sha256.class.getName());
    put("Signature.SHA512withRSA", DeviceSignature.Sha512.class.getName());
    if (Signatures.recording()) Security.insertProviderAt(this, 1);
    else Security.addProvider(this);
  }
}

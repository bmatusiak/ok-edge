package okedge.apksign;

import java.security.PrivateKey;

/**
 * A handle for the slot's key - no key material: it has no encoding, so SunRsaSign cannot take it and the JCA's delayed
 * provider selection reaches DeviceSignature (as a PKCS#11 smartcard's key does). It knows its signature's length.
 */
public final class DeviceKey implements PrivateKey {

  private static final long serialVersionUID = 1L;
  private final String alias;
  private final int signatureBytes;

  DeviceKey(String alias, int signatureBytes) {
    this.alias = alias;
    this.signatureBytes = signatureBytes;
  }

  int signatureBytes() {
    return signatureBytes;
  }

  @Override
  public String getAlgorithm() {
    return "RSA";
  }

  @Override
  public String getFormat() {
    return null;
  }

  @Override
  public byte[] getEncoded() {
    return null;
  }

  @Override
  public String toString() {
    return "DeviceKey[" + alias + ", " + (signatureBytes * 8) + " bits]";
  }
}

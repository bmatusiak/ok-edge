package okedge.apksign;

import java.security.InvalidAlgorithmParameterException;
import java.security.InvalidKeyException;
import java.security.InvalidParameterException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.SignatureException;
import java.security.SignatureSpi;
import java.security.spec.AlgorithmParameterSpec;

/**
 * SHA256withRSA / SHA512withRSA (PKCS#1 v1.5) whose RSA half is the OnlyKey's: the data is hashed here, and the digest
 * is what the key signs - its RSA sign picks the hash by the digest's length (32: SHA-256, 64: SHA-512). apksigner picks
 * SHA-512 for a key over 3072 bits (RSA3, 4096) and SHA-256 below (the debug keystore's 2048). Signatures.java records
 * or replays the digest; nothing here talks to a key.
 */
public abstract class DeviceSignature extends SignatureSpi {

  public static final class Sha256 extends DeviceSignature {
    public Sha256() {
      super("SHA-256");
    }
  }

  public static final class Sha512 extends DeviceSignature {
    public Sha512() {
      super("SHA-512");
    }
  }

  private final MessageDigest md;
  private DeviceKey key;

  DeviceSignature(String hash) {
    try {
      md = MessageDigest.getInstance(hash);
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException(hash + " is unavailable", e);
    }
  }

  @Override
  protected void engineInitSign(PrivateKey privateKey) throws InvalidKeyException {
    if (!(privateKey instanceof DeviceKey)) {
      throw new InvalidKeyException("not an OnlyKey slot's key: " + (privateKey == null ? "null" : privateKey.getClass().getName()));
    }
    key = (DeviceKey) privateKey;
    md.reset();
  }

  /*
   * apksig verifies every signature it makes. REPLAY: this provider is last and refuses ("not my key, keep looking" -
   * an InvalidKeyException), so SunRsaSign checks the key's real signature against the certificate. RECORD: this provider
   * is first and takes the check, which passes - the placeholders are thrown away with the output.
   */
  @Override
  protected void engineInitVerify(PublicKey publicKey) throws InvalidKeyException {
    if (!Signatures.recording()) throw new InvalidKeyException("signs only; another provider verifies");
    md.reset();
  }

  @Override
  protected void engineUpdate(byte b) {
    md.update(b);
  }

  @Override
  protected void engineUpdate(byte[] b, int off, int len) {
    md.update(b, off, len);
  }

  @Override
  protected byte[] engineSign() throws SignatureException {
    if (key == null) throw new SignatureException("not initialised for signing");
    byte[] digest = md.digest();
    byte[] sig = Signatures.answer(digest, key.signatureBytes());
    if (sig.length != key.signatureBytes()) {
      throw new SignatureException("a " + (key.signatureBytes() * 8) + "-bit key's signature is " + key.signatureBytes() + " bytes, not " + sig.length);
    }
    return sig;
  }

  @Override
  protected boolean engineVerify(byte[] sigBytes) throws SignatureException {
    md.reset();
    if (Signatures.recording()) return true;
    throw new SignatureException("signs only");
  }

  /* PKCS#1 v1.5 takes no parameters: anything else (PSS) is refused, never quietly signed as v1.5 */
  @Override
  protected void engineSetParameter(AlgorithmParameterSpec params) throws InvalidAlgorithmParameterException {
    if (params != null) throw new InvalidAlgorithmParameterException("PKCS#1 v1.5 on an OnlyKey takes no parameters (got " + params.getClass().getName() + ")");
  }

  @Override
  @Deprecated
  protected void engineSetParameter(String param, Object value) {
    throw new InvalidParameterException("deprecated parameter API is not supported");
  }

  @Override
  @Deprecated
  protected Object engineGetParameter(String param) {
    throw new InvalidParameterException("deprecated parameter API is not supported");
  }
}

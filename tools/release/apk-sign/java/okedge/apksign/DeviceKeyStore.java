package okedge.apksign;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.Key;
import java.security.KeyStoreException;
import java.security.KeyStoreSpi;
import java.security.cert.Certificate;
import java.security.cert.CertificateException;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.security.interfaces.RSAPublicKey;
import java.util.Collections;
import java.util.Date;
import java.util.Enumeration;

/**
 * One entry, read only: the slot's certificate (--ks-provider-arg, or OKSIGN_CERT) and a handle for its key, sized by
 * the certificate's modulus - the length every signature must have.
 */
public final class DeviceKeyStore extends KeyStoreSpi {

  static final String ALIAS = "okedge";
  private static volatile String certPath;
  private X509Certificate certificate;
  private final Date created = new Date();

  static void setCertPath(String path) {
    certPath = path;
  }

  @Override
  public void engineLoad(InputStream stream, char[] password) throws IOException, CertificateException {
    String path = certPath != null ? certPath : System.getenv("OKSIGN_CERT");
    if (path == null || path.isEmpty()) throw new IOException("no certificate: --ks-provider-arg <cert.pem> or OKSIGN_CERT");
    Path file = Paths.get(path);
    if (!Files.isReadable(file)) throw new IOException("cannot read the certificate at " + file.toAbsolutePath());
    try (InputStream in = Files.newInputStream(file)) {
      certificate = (X509Certificate) CertificateFactory.getInstance("X.509").generateCertificate(in);
    }
    if (!(certificate.getPublicKey() instanceof RSAPublicKey)) throw new CertificateException("not an RSA certificate - an OnlyKey RSA slot's is");
  }

  @Override
  public Key engineGetKey(String alias, char[] password) {
    if (!ALIAS.equalsIgnoreCase(alias) || certificate == null) return null;
    int bits = ((RSAPublicKey) certificate.getPublicKey()).getModulus().bitLength();
    return new DeviceKey(ALIAS, (bits + 7) / 8);
  }

  @Override
  public Certificate[] engineGetCertificateChain(String alias) {
    return ALIAS.equalsIgnoreCase(alias) && certificate != null ? new Certificate[] {certificate} : null;
  }

  @Override
  public Certificate engineGetCertificate(String alias) {
    return ALIAS.equalsIgnoreCase(alias) ? certificate : null;
  }

  @Override
  public Date engineGetCreationDate(String alias) {
    return ALIAS.equalsIgnoreCase(alias) ? new Date(created.getTime()) : null;
  }

  @Override
  public Enumeration<String> engineAliases() {
    return Collections.enumeration(Collections.singletonList(ALIAS));
  }

  @Override
  public boolean engineContainsAlias(String alias) {
    return ALIAS.equalsIgnoreCase(alias);
  }

  @Override
  public int engineSize() {
    return 1;
  }

  @Override
  public boolean engineIsKeyEntry(String alias) {
    return ALIAS.equalsIgnoreCase(alias);
  }

  @Override
  public boolean engineIsCertificateEntry(String alias) {
    return false;
  }

  @Override
  public String engineGetCertificateAlias(Certificate cert) {
    return certificate != null && certificate.equals(cert) ? ALIAS : null;
  }

  @Override
  public void engineSetKeyEntry(String alias, Key key, char[] password, Certificate[] chain) throws KeyStoreException {
    throw new KeyStoreException("read only: the key is in the OnlyKey");
  }

  @Override
  public void engineSetKeyEntry(String alias, byte[] key, Certificate[] chain) throws KeyStoreException {
    throw new KeyStoreException("read only: the key is in the OnlyKey");
  }

  @Override
  public void engineSetCertificateEntry(String alias, Certificate cert) throws KeyStoreException {
    throw new KeyStoreException("read only: the key is in the OnlyKey");
  }

  @Override
  public void engineDeleteEntry(String alias) throws KeyStoreException {
    throw new KeyStoreException("read only: the key is in the OnlyKey");
  }

  @Override
  public void engineStore(OutputStream stream, char[] password) throws IOException {
    throw new IOException("read only: the key is in the OnlyKey");
  }
}

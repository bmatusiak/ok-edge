/**
 * CRYPTO FOR THE SHELL - the picker. Imported FIRST by index.ts, before the library loads, as
 * ok-rn's index.js does.
 *
 *   android   Hermes has no crypto.getRandomValues and no crypto.subtle: ok-rn's three
 *             installers put them in place from the native modules (okedge-native): the
 *             platform's SecureRandom, WebCrypto from the library with RSA keygen and PBKDF2
 *             done natively, and OpenSSL as the library's crypto provider.
 *   electron  the page is Chromium: it has both already
 *   web       the browser has both already
 *
 * The requires sit inside the branch so the other shells never run a TurboModule lookup.
 */
import { shell } from './platform';

if (shell === 'android') {
  require('./installRandom');
  require('./installWebCrypto');
  require('./okSslCrypto');
}

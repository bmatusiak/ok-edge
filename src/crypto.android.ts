/**
 * CRYPTO FOR THE PHONE (crypto.ts is the web and desktop page's: nothing to install). Imported FIRST by index.ts, before the library loads, as
 * ok-rn's index.js does.
 *
 *   android   Hermes has no crypto.getRandomValues and no crypto.subtle: ok-rn's three
 *             installers put them in place from the native modules (okedge-native): the
 *             platform's SecureRandom, WebCrypto from the library with RSA keygen and PBKDF2
 *             done natively, and OpenSSL as the library's crypto provider.
 *   electron  the page is Chromium: it has both already
 *   web       the browser has both already
 *
 * Metro picks this file for Android only, so the other shells never run a TurboModule lookup.
 */
require('./installRandom');
require('./installWebCrypto');
require('./okSslCrypto');

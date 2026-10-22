'use strict';

/**
 * NativeRsaGen on the desktop: a fresh RSA key's primes from Node's OpenSSL, in the same shape the
 * phone's module gives ("<p hex>:<q hex>", each exactly bits/16 bytes) - Key Chain loads them onto
 * the key and/or exports an encrypted copy; nothing is kept here. Async, so a 4096-bit key does
 * not freeze the window.
 */
const crypto = require('crypto');
const { promisify } = require('util');

const generateKeyPair = promisify(crypto.generateKeyPair);
const hexOf = (b64url) => Buffer.from(b64url, 'base64url').toString('hex');

async function generatePrimes(bits, publicExponent) {
  if (![2048, 3072, 4096].includes(bits)) throw new Error(`RSA keys are 2048, 3072 or 4096 bits; got ${bits}`);
  const { privateKey } = await generateKeyPair('rsa', { modulusLength: bits, publicExponent });
  const jwk = privateKey.export({ format: 'jwk' });
  /* bits/16 bytes each = bits/8 hex digits, leading zeros kept */
  const pad = (h) => h.padStart(bits / 8, '0');
  return `${pad(hexOf(jwk.p))}:${pad(hexOf(jwk.q))}`;
}

module.exports = { handlers: { 'NativeRsaGen:generatePrimes': generatePrimes } };

/*
 * THE REPO DEBUG KEYSTORE'S RSA KEY AS p||q HEX, for a test key's RSA slot (rehearsals/gadget-rsa-key.yaml,
 * scripts/rsa-key-load.js). Brad, 2026-11-05: "never assume blue key between runs" - a flow that needs the debug key in
 * a slot puts it there itself, so it reads the key here instead of being handed it. signing/debug.keystore is React
 * Native's template key (JKS, store and key password "android") - public, never a real signing key; the release key is
 * red-key's RSA3 and has no file anywhere.
 *
 *   node tools/box/debug-key-hex.js        prints one line: p||q, 512 hex characters (RSA-2048)
 *
 * keytool turns the JKS into PKCS#12 (a temp file, removed after), openssl takes the key out, node gives its p and q.
 */
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const store = path.join(__dirname, '..', '..', 'signing', 'debug.keystore');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'debug-key-'));
const p12 = path.join(dir, 'debug.p12');
try {
  execFileSync('keytool', ['-importkeystore', '-noprompt', '-srckeystore', store, '-srcstorepass', 'android', '-srcalias', 'androiddebugkey',
    '-srckeypass', 'android', '-destkeystore', p12, '-deststoretype', 'PKCS12', '-deststorepass', 'android'], { stdio: 'pipe' });
  const pem = execFileSync('openssl', ['pkcs12', '-in', p12, '-nocerts', '-nodes', '-passin', 'pass:android'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const jwk = crypto.createPrivateKey(pem.slice(pem.indexOf('-----BEGIN'))).export({ format: 'jwk' });
  const hex = (b64u) => Buffer.from(b64u, 'base64url').toString('hex');
  const pq = hex(jwk.p) + hex(jwk.q);
  if (pq.length !== 512) throw new Error(`not an RSA-2048 key (p||q is ${pq.length / 2} bytes)`);
  console.log(pq);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}

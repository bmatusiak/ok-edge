'use strict';

/**
 * NativeSecrets' sealed box on the desktop - the phone's KeystoreBox: something sealed without a
 * prompt, under a key only this app on this machine can use, and gone for good once forgotten.
 *
 * One AES-256-GCM key per alias, made here and kept ENCRYPTED BY THE OS through Electron's
 * safeStorage (DPAPI on Windows, the keychain/libsecret elsewhere) in <userData>/box/<alias>.key.
 * Sealed text is hex: iv (12) | tag (16) | ciphertext. Forgetting an alias deletes its key, so
 * everything sealed under it stays sealed.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');

const dir = () => path.join(app.getPath('userData'), 'box');
const keyFile = (alias) => {
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(alias)) throw new Error(`a box alias is letters, digits and . _ -; got "${alias}"`);
  return path.join(dir(), `${alias}.key`);
};

/* safeStorage's async calls (the sync ones are deprecated in Electron 45) */
async function keyOf(alias, { create }) {
  if (!(await safeStorage.isAsyncEncryptionAvailable())) throw new Error('this desktop has no OS encryption for the box (safeStorage unavailable)');
  const f = keyFile(alias);
  if (fs.existsSync(f)) {
    const { result, shouldReEncrypt } = await safeStorage.decryptStringAsync(fs.readFileSync(f));
    /* the OS rotated its key: keep the box key under the new one */
    if (shouldReEncrypt) fs.writeFileSync(f, await safeStorage.encryptStringAsync(result), { mode: 0o600 });
    return Buffer.from(result, 'hex');
  }
  if (!create) throw new Error(`no box key "${alias}" - it was forgotten, or never made`);
  const key = crypto.randomBytes(32);
  fs.mkdirSync(dir(), { recursive: true, mode: 0o700 });
  fs.writeFileSync(f, await safeStorage.encryptStringAsync(key.toString('hex')), { mode: 0o600 });
  return key;
}

async function boxSeal(alias, hex) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', await keyOf(alias, { create: true }), iv);
  const ct = Buffer.concat([c.update(Buffer.from(hex, 'hex')), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString('hex');
}

async function boxOpen(alias, hex) {
  const b = Buffer.from(hex, 'hex');
  const d = crypto.createDecipheriv('aes-256-gcm', await keyOf(alias, { create: false }), b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('hex');
}

function boxForget(alias) {
  const f = keyFile(alias);
  if (!fs.existsSync(f)) return false;
  fs.rmSync(f);
  return true;
}

module.exports = {
  handlers: {
    'NativeSecrets:boxSeal': boxSeal,
    'NativeSecrets:boxOpen': boxOpen,
    'NativeSecrets:boxForget': boxForget,
  },
};

import {readKeyChainList, updateKeyChainList} from './keyChainRecorder';

const keychain = require('node-onlykey-lib/keychain');

/*
 * THE PGP STEPS ENCRYPT / DECRYPT AND CRYPTOBOX SHARE (Brad's rule: reuse the logic that works).
 * Encrypt / Decrypt did these inline; Cryptobox needs the same ones, so they live here once:
 * your +PQC keys on the device, arming one for a decrypt or a signature, and finding which of
 * them a message was encrypted to.
 *
 * The 1.2 MB OpenPGP fork is required lazily (see MessagesScreen's header): never at module
 * scope, so opening the app does not load it.
 */

export const openpgpFork = () => require('node-onlykey-lib/crypto/pgp');

/*
 * a composite (+PQC) key Key Chain made and keeps the public certificate of; its private half is on the device. ONE
 * per key (its fingerprint), however many slots the list has seen it in: which slot holds it NOW is asked of the key
 * each time it is armed (keychain composite.locate) - the user may have put another key in the old one.
 */
export type DeviceKey = {id: string; name: string; slot: number; pgp: string; pgpFingerprint: string};

export async function readDeviceKeys(): Promise<DeviceKey[]> {
  const list = await readKeyChainList();
  return list
    /* only a key that can sign here: one Key Chain has not seen replaced (keychain list.present) */
    .filter(e => e.type === 'composite' && e.pgp && e.pgpFingerprint && (e.slots || []).length && keychain.list.present(e))
    /* the entry the key was seen in last first, so the one kept per fingerprint is the newest */
    .sort((a, b) => Number(keychain.list.present(b)) - Number(keychain.list.present(a)) || String(b.lastSeen || '').localeCompare(String(a.lastSeen || '')))
    .filter((e, i, all) => all.findIndex(x => String(x.pgpFingerprint).toUpperCase() === String(e.pgpFingerprint).toUpperCase()) === i)
    .map(e => ({id: e.id, name: e.name || 'composite key', slot: e.slots[0], pgp: e.pgp, pgpFingerprint: e.pgpFingerprint}));
}

/*
 * DEVICE-BACKED: the kept key is the PUBLIC half, and the fork is handed a placeholder private key
 * whose secret scalars are marked hardware-backed. Its hooks then call the device for the X25519
 * and ML-KEM halves of a decrypt and both halves of a signature; the device raises a three-button
 * challenge for each (`onChallenge` gets the digits, then null). disarm() clears the hooks so a
 * later generate is not hijacked (see composite_pgp.js on hooks.signer) and drops the listener.
 */
export async function armDeviceKey(
  getKey: () => Promise<{okcrypto: any}>,
  key: DeviceKey,
  onChallenge: (digits: number[] | null) => void,
): Promise<{privateKey: unknown; slot: number; proven: () => Promise<void>; disarm: () => void}> {
  const openpgp = openpgpFork();
  const {okcrypto, device} = (await getKey()) as any;
  /*
   * WHERE THE KEY IS NOW (Brad, 2026-10-25: "key management to be dymanic, its possible the user may already be using
   * the slot"): the slots read from the key - no press, no config mode - and the list corrected by what they hold, then
   * the slot chosen by Key Chain (keychain composite.locate). The signature hook proves the choice by its answer.
   */
  const slots = await keychain.composite.readRsaSlots(device);
  const now = new Date().toISOString();
  await updateKeyChainList(entries => keychain.composite.reconcile(entries, slots, now));
  const where = keychain.composite.locate(await readKeyChainList(), key, slots);
  /* only the choices that exist: with no composite key on this OnlyKey there is nothing to adopt (texts true and accurate) */
  if (where.slot === null) throw new Error(`${key.name}: ${where.why}. In Key Chain: ${where.reason === 'none' ? 'make a new one with the Wizard' : 'adopt a composite key on this OnlyKey, or make a new one'}.`);
  const pub = await openpgp.readKey({armoredKey: key.pgp});
  const privateKey = openpgp.createHardwarePrivateKey(pub);
  okcrypto.registerPgpHooks(openpgp, where.slot);
  const off = okcrypto.on('challenge', ({digits}: {digits: number[]}) => onChallenge(digits));
  return {
    privateKey,
    slot: where.slot,
    /* the key answered for this slot (a signature that checked, a message it opened): Key Chain records it there */
    proven: () => updateKeyChainList(entries => keychain.composite.seen(entries, key, where.slot)),
    disarm: () => {
      onChallenge(null);
      if (typeof off === 'function') off();
      try {
        openpgp.clearHardwareHooks();
      } catch {
        /* not loaded */
      }
    },
  };
}

/* which of your device keys an encrypted message is for: its recipient key ids against your keys' ids */
export async function deviceKeyFor(armored: string, keys: DeviceKey[]): Promise<DeviceKey | null> {
  const openpgp = openpgpFork();
  const message = await openpgp.readMessage({armoredMessage: armored});
  const wanted = new Set<string>(message.getEncryptionKeyIDs().map((id: any) => String(id.toHex()).toLowerCase()));
  for (const k of keys) {
    try {
      const key = await openpgp.readKey({armoredKey: k.pgp});
      if (key.getKeyIDs().some((id: any) => wanted.has(String(id.toHex()).toLowerCase()))) return k;
    } catch {
      /* a certificate the fork cannot read matches nothing */
    }
  }
  return null;
}

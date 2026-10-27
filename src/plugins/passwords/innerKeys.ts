import {inner} from 'node-onlykey-lib/passwords';

import {challengeOpts} from '../../hostChallenge';
import {noteOwnSecret} from '../../ownAsks';

/*
 * AN ENTRY'S SECRETS COST A PRESS, EVERY TIME (Brad, 2026-10-27: "the secret in password do now need
 * to require a press"; "no passphrase as an option to secure a password, press decrypt only"; lib
 * passwords/src/inner.js). Every entry's password, earlier passwords, notes and authenticator setup key
 * are sealed under its own key: the OnlyKey's TOUCH derived secret of `okedge/passwords/v1/<identity>/<id>`
 * (firmware plugin derive_secret) - a press, whatever the key's derive setting says. There is no other
 * seal: no plain entry, no passphrase.
 *
 * ONE PRESS PER VISIT. Opening an entry asks the key once and hands back its key with it; the entry's page
 * keeps both while it is up - so an edit, or an HOTP counter, seals again without a second press - and
 * wipes the key when the page goes (PasswordsScreen `opened`).
 */

/* the parts of okcrypto this uses (lib plugins/okcrypto deriveSecret) */
export type DeriveOkcrypto = {deriveSecret(label: string, opts?: object): Promise<Uint8Array>};

declare const crypto: {getRandomValues<T extends Uint8Array>(array: T): T};
const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));

/** The key of one entry: its touch derive, the press asked on the app's sheet (the hard key's waits there). */
export async function entryKey(okcrypto: DeriveOkcrypto, identity: string, ref: string, what: string): Promise<Uint8Array> {
  const ask = challengeOpts(what);
  /* the soft key's sheet names this press (its record carries only the label's hash) */
  noteOwnSecret(inner.entryLabel(identity, ref), true, what);
  const t0 = Date.now();
  if (__DEV__) console.log(`[passwords] entry derive start ${ref.slice(0, 8)}`);  try {
    const k = await inner.entryKey(okcrypto, identity, ref, {
      confirm: (a: {digits?: number[] | null}) => {
        if (__DEV__) console.log(`[passwords] entry derive confirm +${Date.now() - t0}ms digits ${a.digits ? a.digits.join(' ') : 'none'}`);        ask.opts.confirm({digits: a.digits ?? undefined});
      },
      timeoutMs: 40000,
    });
    if (__DEV__) console.log(`[passwords] entry derive done +${Date.now() - t0}ms`);
    return k;
  } catch (e) {
    if (__DEV__) console.log(`[passwords] entry derive failed +${Date.now() - t0}ms: ${String((e as Error)?.message ?? e).slice(0, 160)}`);
    throw e;
  } finally {
    ask.done();
  }
}

/**
 * Seal an entry's secrets under its key. A new entry gets its ref here - its id once stored. `key`: the
 * entry's key from an open on this visit (no press); without it, the key is asked (one press).
 * -> the entry to save, and its key (the caller wipes it with the page).
 */
export async function sealEntry(
  entry: any,
  okcrypto: DeriveOkcrypto,
  identity: string,
  key?: Uint8Array | null,
): Promise<{entry: any; key: Uint8Array}> {
  const ref: string = entry.id ?? inner.newRef(randomBytes);
  const k = key ?? (await entryKey(okcrypto, identity, ref, `Passwords: seal "${entry.title}"`));
  return {entry: inner.sealInner({...stripInner(entry), ...(entry.id ? {id: entry.id} : {})}, k, randomBytes, {ref}), key: k};
}

/** Open an entry's secrets: one press. -> the entry with its secrets back, and its key for this visit. */
export async function openEntry(entry: any, okcrypto: DeriveOkcrypto, identity: string): Promise<{entry: any; key: Uint8Array}> {
  if (!entry?.inner) return {entry, key: new Uint8Array(0)};
  const k = await entryKey(okcrypto, identity, entry.id, `Passwords: open "${entry.title}"`);
  try {
    return {entry: inner.openInner(entry, k), key: k};
  } catch (e) {
    k.fill(0);
    throw new Error(/another entry/.test(String((e as Error)?.message)) ? 'this seal belongs to another entry - it was moved, so it is not opened' : 'this key does not open the entry');
  }
}

/** An opened entry back to its plain shape (no `inner`). */
export function stripInner(entry: any): any {
  const {inner: _inner, ...rest} = entry;
  return rest;
}

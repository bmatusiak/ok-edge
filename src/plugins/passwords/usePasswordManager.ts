/*
 * The Password Manager's hooks: usePasswordManager for the Passwords screen, usePasswordWatch for
 * the part that must run while the tab is off screen. The rules live in stores.ts; this file is
 * when they run.
 *
 * One stores object for the whole app (module scope), so a store opened on the tab stays open
 * when the person switches tabs and comes back - the store key is held until the key locks, not
 * the screen. Because it outlives the screen, closing it cannot be the screen's job either:
 * usePasswordWatch is mounted with the app and closes a key's store the moment that key stops
 * being unlocked (each key on its own - a hard key unplugged does not close the soft key's view).
 * A sync that brings entries reads the store again with the key it holds (lib reload): no derive.
 */

import {useCallback, useEffect, useRef, useState} from 'react';

import {getOnlyKey} from '../../onlykey';
import {bucketStorage, openBucketIdentity} from '../../bucketStore';
import {onBucketTraded} from '../../bucketEvents';
import {challengeOpts} from '../../hostChallenge';
import {noteOwnSecret, secretRecordLabel} from '../../ownAsks';
import {onSilentUse, startPressRecords} from '../../pressAsk';
import {manager as passwordsLib} from 'node-onlykey-lib/passwords';
import {createStores, type Backend, type Manager, type Okcrypto, type OpenWhy, type SilentWatch} from './stores';
import type {DeriveOkcrypto} from './innerKeys';

declare const crypto: {getRandomValues<T extends Uint8Array>(array: T): T};

const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));

/*
 * THE STORES' STORAGE: store 'passwords' in this identity's sealed bucket (src/bucketStore.ts), each key
 * `<identity>/...` as the bucket's merge rule names them (bucket/src/rules.js passwords). No plain records move
 * in (pre-v1, no migration): a key with no bucket identity has no password store.
 */
/*
 * DID THE KEY ASK? The soft key says when it answered a derive unasked (its "silent" record, src/pressAsk.ts): the
 * store's label, in the record's shape. The event can land a moment after the derive's answer, so a short grace.
 */
const SILENT_GRACE_MS = 400;
function watchSilent(label: string): SilentWatch {
  startPressRecords();
  const want = secretRecordLabel(label, false);
  let seen = false;
  const stop = onSilentUse(u => { if (u.label === want) seen = true; });
  return {
    async answeredSilently() {
      if (!seen) await new Promise(r => setTimeout(r, SILENT_GRACE_MS));
      return seen;
    },
    stop,
  };
}

export const stores = createStores({storage: bucketStorage(() => 'passwords', (k: string) => `okrn.passwords.${k}`), randomBytes, watchSilent});

const BACKENDS: Backend[] = ['embedded', 'usb'];

/** The derive a phrase or a derived password needs (okcrypto.deriveSharedSecretFor). */
export type PhraseOkcrypto = {deriveSharedSecretFor(label: string, opts: object): Promise<Uint8Array>};

const okcryptoOf = async (backend: Backend) => (await getOnlyKey(backend)).okcrypto as unknown as Okcrypto & DeriveOkcrypto & PhraseOkcrypto;

/* the soft key's sheet names the store key's derive (its record carries only the label's hash) */
const noteStoreAsk = (identity: string) => noteOwnSecret(passwordsLib.storeLabel(identity.toLowerCase()), false, 'Passwords: open your list');

/**
 * Mounted once, with the app. `unlocked`: each key's "is it unlocked and running" right now.
 */
export function usePasswordWatch(unlocked: Record<Backend, boolean>): void {
  const {embedded, usb} = unlocked;
  useEffect(() => {
    const before = stores.openCount();
    for (const b of BACKENDS) if (!(b === 'embedded' ? embedded : usb)) stores.close(b);
    if (stores.openCount() !== before) notify();
  }, [embedded, usb]);

  /* passwords a sync brought: every open store reads itself again, with the key it holds */
  useEffect(
    () =>
      onBucketTraded(changed => {
        if (!changed.includes('passwords')) return;
        void Promise.all(BACKENDS.map(b => stores.current(b)?.reload().catch(() => undefined))).then(notify);
      }),
    [],
  );
}

/* screens listening for a store opening or closing elsewhere (a lock, a sync, the other key) */
const listeners = new Set<() => void>();
/** A store's entries changed elsewhere (the Autofill sheet saved one): redraw the tab. */
export function storesChanged() {
  notify();
}
function notify() {
  for (const l of listeners) l();
}

export type ManagerView =
  | {state: 'locked-key'}
  /* the key is unlocked but no identity's bucket is open (the identity check has not run, or the key has none) */
  | {state: 'no-bucket'}
  | {state: 'checking'}
  | {state: 'button'; identity: string}
  | {state: 'pressing'; identity: string}
  | {state: 'open'; identity: string; manager: Manager; why: OpenWhy}
  | {state: 'error'; message: string};

/**
 * The store of the ACTIVE key's identity. On mount (the tab opens) it opens by itself when its last
 * open asked nothing; otherwise it shows the button. `openWithKey` is the button.
 */
export function usePasswordManager({backend, unlocked}: {backend: Backend; unlocked: boolean}) {
  const [view, setView] = useState<ManagerView>({state: 'checking'});
  const [rev, setRev] = useState(0);
  const busy = useRef(false);
  /* Lock now holds the store shut until the tab is opened again - one that opens by itself would
   * otherwise open again on the spot, and Lock would do nothing */
  const held = useRef(false);

  /* follow stores opened, closed or reloaded elsewhere */
  useEffect(() => {
    const l = () => setRev(n => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);

  const identity = openBucketIdentity()?.identity ?? null;

  useEffect(() => {
    if (!unlocked) return setView({state: 'locked-key'});
    if (!identity) return setView({state: 'no-bucket'});
    if (busy.current) return;
    const open = stores.current(backend);
    if (open) {
      setView(v => (v.state === 'open' && v.manager === open ? {...v} : {state: 'open', identity, manager: open, why: 'session'}));
      return;
    }
    if (held.current) return setView({state: 'button', identity});
    let live = true;
    busy.current = true;
    setView({state: 'checking'});
    const ask = challengeOpts('Opening your passwords');
    noteStoreAsk(identity ?? (view as {identity?: string}).identity ?? '');
    (async () => {
      const r = await stores.tryOpen(backend, await okcryptoOf(backend), identity, a => ask.opts.confirm({digits: a.digits ?? undefined}));
      if (!live) return;
      setView(r ? {state: 'open', identity, manager: r.manager, why: r.why} : {state: 'button', identity});
    })()
      .catch(err => live && setView({state: 'error', message: String(err?.message ?? err)}))
      .finally(() => {
        ask.done();
        busy.current = false;
      });
    return () => {
      live = false;
    };
  }, [backend, unlocked, identity, rev]);

  const openWithKey = useCallback(async () => {
    if (view.state !== 'button' || busy.current) return;
    busy.current = true;
    held.current = false;
    setView({state: 'pressing', identity: view.identity});
    const ask = challengeOpts('Opening your passwords');
    noteStoreAsk(identity ?? (view as {identity?: string}).identity ?? '');
    try {
      const r = await stores.openWithKey(backend, await okcryptoOf(backend), view.identity, a => ask.opts.confirm({digits: a.digits ?? undefined}));
      setView({state: 'open', identity: view.identity, manager: r.manager, why: r.why});
      notify();
    } catch (err: any) {
      setView({state: 'error', message: String(err?.message ?? err)});
    } finally {
      ask.done();
      busy.current = false;
    }
  }, [backend, view]);

  const lockNow = useCallback(() => {
    held.current = true;
    stores.lockNow(backend);
    notify();
  }, [backend]);

  const retry = useCallback(() => setRev(n => n + 1), []);

  /** This key's okcrypto: an entry's press derive (innerKeys.ts), and a phrase's or a derived password's derive. */
  const keyFor = useCallback(() => okcryptoOf(backend), [backend]);

  return {view, openWithKey, lockNow, retry, keyFor};
}

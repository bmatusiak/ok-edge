/*
 * THE PASSWORD STORES, one per bucket identity - the part of the hook with no React in it, so the
 * rules below are tested without a phone (__tests__/stores.test.ts).
 *
 * A BUCKET IN THE BUCKET (Brad, 2026-10-27: "app bucket -> password bucket protected by derive key,
 * password contains labels to derive the decryptions for the secret"; lib passwords/src/manager.js):
 *   - the identity's bucket holds this store (bucketStore.ts, store 'passwords', `<identity>/...`);
 *   - the store's records are sealed under THE STORE KEY: the key's touchless derive of
 *     storeLabel(identity), asked when the list opens and held until the key locks;
 *   - each record holds an entry's labels and its own seal of its secrets (innerKeys.ts: a press).
 *
 * TOUCHLESS IS "PROTECTED UNTIL UNPROTECTED" (Brad, 2026-10-27): the key's derive setting (field 30)
 * decides whether the store key's derive asks first - the 3-button code by default. So the tab opens
 * the store by itself only when its last open asked nothing (Brad, 2026-10-11: "if there is a press
 * needed, then a Open with OnlyKey button will be needed so we dont hammer the key"): switching tabs
 * never sends a request that waits for the person.
 *
 * ONE STORE PER IDENTITY, shared by the keys looking at it: a soft key and a hard key restored from
 * one backup have one identity, one bucket and one store; a lock or an unplug of one key leaves the
 * other's view open.
 */

import {manager as m} from 'node-onlykey-lib/passwords';

export type Backend = 'embedded' | 'usb';
export type Manager = Awaited<ReturnType<typeof m.openStore>>;

/*
 * What a store records about itself, beside its records: whether its last open asked the person
 * (the code or a press) - then the tab waits for the button.
 */
export type StoreMeta = {v: 2; asked: boolean};

/** Key/value storage with AsyncStorage's three methods. */
export type KV = {
  getItem(k: string): Promise<string | null>;
  setItem(k: string, v: string): Promise<void>;
  removeItem(k: string): Promise<void>;
};

/** The parts of a backend's okcrypto this uses (lib plugins/okcrypto deriveSecret). */
export type Okcrypto = {
  deriveSecret(label: string, opts?: {confirm?: (a: {digits?: number[] | null}) => void; timeoutMs?: number}): Promise<Uint8Array>;
};

export type OpenWhy = 'session' | 'by-itself' | 'asked';

const META = 'meta';

/* watching one derive for the key's word that it answered unasked (the soft key's "silent" record) */
export type SilentWatch = {answeredSilently(): Promise<boolean>; stop(): void};

export function createStores({
  storage,
  randomBytes,
  now = () => new Date(),
  watchSilent,
}: {
  storage: KV;
  randomBytes: (n: number) => Uint8Array;
  now?: () => Date;
  watchSilent?: (label: string) => SilentWatch;
}) {
  /* identity -> the open store and the backends looking at it */
  const open = new Map<string, {manager: Manager; backends: Set<Backend>}>();
  /* backend -> the identity its store was opened for */
  const idOf = new Map<Backend, string>();

  const kvFor = (identity: string) => m.prefixedStore(storage, `${identity.toLowerCase()}/`) as KV;

  async function readMeta(identity: string): Promise<StoreMeta | null> {
    const raw = await kvFor(identity).getItem(META);
    if (!raw) return null;
    try {
      const meta = JSON.parse(raw);
      return meta?.v === 2 ? {v: 2, asked: meta.asked === true} : null;
    } catch {
      return null;
    }
  }

  /* the store key, from the key; `asked` turns true when the key waits for the person (the code or a press) */
  /*
   * The store key, from the key, and whether the key ASKED the person. confirm() starts before every derive (the lib
   * cannot know the key's setting), so it says nothing; only the key's own word that it answered unasked does -
   * watchSilent (the soft key's "silent" record for this label). Without that word - a hard key, an older build -
   * it counts as asked: the button stays, never a request that waits for the person on its own.
   */
  async function storeKey(okcrypto: Okcrypto, identity: string, confirm?: (a: {digits?: number[] | null}) => void) {
    const label = m.storeLabel(identity.toLowerCase());
    const watch = watchSilent?.(label);
    try {
      const key = await okcrypto.deriveSecret(label, {confirm: a => confirm?.(a), timeoutMs: 40000});
      return {key, asked: !(await watch?.answeredSilently())};
    } finally {
      watch?.stop();
    }
  }

  async function attach(identity: string, backend: Backend, key: Uint8Array): Promise<Manager> {
    const held = open.get(identity);
    if (held) {
      key.fill(0);
      held.backends.add(backend);
      idOf.set(backend, identity);
      return held.manager;
    }
    try {
      const manager = await m.openStore({store: kvFor(identity), key, randomBytes, now});
      open.set(identity, {manager, backends: new Set([backend])});
      idOf.set(backend, identity);
      return manager;
    } finally {
      key.fill(0);
    }
  }

  return {
    readMeta,

    /** The open store this backend looks at, or null. */
    current(backend: Backend): Manager | null {
      const id = idOf.get(backend);
      return (id && open.get(id)?.manager) || null;
    },

    /**
     * Open without waiting for the person if that is possible, else null (the screen shows its
     * button): the store already open for this identity (another key of the same backup), or one
     * whose last open asked nothing. `confirm` still shows a code the key asks after all (its
     * derive setting changed since).
     */
    async tryOpen(
      backend: Backend,
      okcrypto: Okcrypto,
      identity: string,
      confirm?: (a: {digits?: number[] | null}) => void,
    ): Promise<{manager: Manager; why: OpenWhy} | null> {
      const held = open.get(identity);
      if (held) {
        held.backends.add(backend);
        idOf.set(backend, identity);
        return {manager: held.manager, why: 'session'};
      }
      const meta = await readMeta(identity);
      if (!meta || meta.asked) return null;
      const r = await storeKey(okcrypto, identity, confirm);
      if (r.asked) await kvFor(identity).setItem(META, JSON.stringify({v: 2, asked: true}));
      return {manager: await attach(identity, backend, r.key), why: r.asked ? 'asked' : 'by-itself'};
    },

    /** The button: the store key's derive, the code shown by `confirm` if the key asks for one. */
    async openWithKey(
      backend: Backend,
      okcrypto: Okcrypto,
      identity: string,
      confirm?: (a: {digits?: number[] | null}) => void,
    ): Promise<{manager: Manager; why: OpenWhy}> {
      const r = await storeKey(okcrypto, identity, confirm);
      const meta = await readMeta(identity);
      if (!meta || meta.asked !== r.asked) await kvFor(identity).setItem(META, JSON.stringify({v: 2, asked: r.asked}));
      return {manager: await attach(identity, backend, r.key), why: r.asked ? 'asked' : 'by-itself'};
    },

    /**
     * This key locked, was unplugged or stopped: let go of its store. The store closes (entries
     * dropped, its key wiped) only when no other key is still looking at it.
     */
    close(backend: Backend): void {
      const id = idOf.get(backend);
      idOf.delete(backend);
      const held = id ? open.get(id) : undefined;
      if (!id || !held) return;
      held.backends.delete(backend);
      if (held.backends.size === 0) {
        held.manager.lock();
        open.delete(id);
      }
    },

    /** "Lock now": the store closes for every key looking at it. */
    lockNow(backend: Backend): void {
      const id = idOf.get(backend);
      const held = id ? open.get(id) : undefined;
      for (const b of held ? [...held.backends] : [backend]) this.close(b);
    },

    /** for tests */
    openCount: () => open.size,
  };
}

export type Stores = ReturnType<typeof createStores>;

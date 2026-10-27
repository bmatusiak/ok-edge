/*
 * THIS KEY'S IDENTITY: READ ONCE, KEPT TO SHOW (Brad, 2026-10-25: "in This Key tab we need a new panel at the top called
 * Identity, so we can see it if it goes past identity check automatically").
 *
 * The identity check (src/screens/IdentityCheckScreen.tsx) reads it after the unlock and, when this computer already
 * keeps that identity's bucket, opens the app by itself - so nothing on screen said which identity it was. The read
 * lives here: the check uses it, keeps its result, and This Key's Identity panel shows the result beside the bucket
 * that is actually open (src/bucketStore.ts openBucketIdentity) - the two must be the same identity - and can read the
 * key again.
 */
import {useEffect, useState} from 'react';
import * as bucketLib from 'node-onlykey-lib/bucket';
import {bucketState} from './bucketStore';
import {ensureNametag} from './edgeDevices';
import {SoftKeyEdge} from './edgeSoftKey';
import {activeBackend} from './hooks/KeyContext';
import {getOnlyKey} from './onlykey';
import {setKeySite} from './serverRoom';

export type KeyIdentity =
  | {kind: 'read'; identity: string; edgeIdentity: string | null; nametag: string | null; bucket: 'kept' | 'sealed' | 'none'; at: number}
  | {kind: 'none'; why: string; at: number};

let last: KeyIdentity | null = null;
const listeners = new Set<() => void>();

/** The latest read of the active key's identity (null: not read since the app started). */
export function lastKeyIdentity(): KeyIdentity | null {
  return last;
}
export function useKeyIdentity(): KeyIdentity | null {
  const [v, setV] = useState<KeyIdentity | null>(last);
  useEffect(() => {
    const l = () => setV(last);
    listeners.add(l);
    l();
    return () => { listeners.delete(l); };
  }, []);
  return v;
}

/**
 * Read the active key's bucket identity, Edge identity and nametag, and what this device holds of its bucket.
 * Kept as the latest read. `alive` stops it quietly when its screen is gone.
 */
export async function readKeyIdentity(alive: () => boolean = () => true): Promise<KeyIdentity | null> {
  try {
    /*
     * A KEY JUST UNLOCKED IS STILL SETTLING (box, 2026-10-24): the hard key re-connects right after its unlock
     * (useHardKey), and a question asked in that moment timed out - asked again a moment later, it answered.
     * So the bucket identity is asked twice more, 1.5 s apart, before "could not read" is said.
     */
    const {okcrypto} = await getOnlyKey(activeBackend());
    let identity: string | null = null;
    let why = '';
    for (let n = 0; n < 3 && alive() && !identity; n++) {
      try {
        identity = (await bucketLib.bucketIdentity.readIdentity(okcrypto as any)).id;
      } catch (e: unknown) {
        why = String((e as Error)?.message ?? e);
        if (n < 2) await new Promise(r => setTimeout(r, 1500));
      }
    }
    if (!alive()) return null;
    if (!identity) return keep({kind: 'none', why: `Could not read this key's bucket identity: ${why}`, at: Date.now()});
    /* Edge, when the key has it: this device's nametag, and its Edge identity - only to move a bucket kept under it */
    const soft = await SoftKeyEdge.open().catch(() => null);
    const edgeIdentity = soft ? (await soft.identityId().catch(() => null))?.toLowerCase() ?? null : null;
    const statement = soft ? await ensureNametag(soft).catch(() => null) : null;
    /* asked here so the check's button says what it will do; unknown is treated as the press it may need */
    const bucket = await bucketState(identity, edgeIdentity).catch(() => 'sealed' as const);
    /*
     * THE KEY'S SITE - where its bucket sync lives (src/serverRoom.ts setKeySite): ctap_bridge's site, read from the
     * key itself. A key without ctap_bridge, or with it off, has none: no server, Bluetooth only.
     */
    const site = await (okcrypto as any).keySite?.().then((r: {on: boolean; site: string | null}) => (r.on ? r.site : null)).catch(() => null) ?? null;
    setKeySite(site);
    if (!alive()) return null;
    return keep({kind: 'read', identity, edgeIdentity, nametag: statement?.nametag ?? null, bucket, at: Date.now()});
  } catch (e: unknown) {
    return alive() ? keep({kind: 'none', why: `Could not read this key's bucket identity: ${String((e as Error)?.message ?? e)}`, at: Date.now()}) : null;
  }
}

function keep(r: KeyIdentity): KeyIdentity {
  last = r;
  for (const l of [...listeners]) l();
  return r;
}

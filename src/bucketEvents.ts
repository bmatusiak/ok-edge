/*
 * A SYNC BROUGHT CHANGES INTO THE BUCKET (Brad, 2026-10-25: "a banner in password tab to tell the user to decrypt the
 * incoming password data from sync, so it can merge into passwords properly").
 *
 * The bucket changes under a screen that already read it: on the phone the trade takes them in (src/bucketTrade.ts);
 * on the desktop the sync service the app hosts does (electron/desktop/sync.js, src/sync.ts). Either way this says
 * which stores changed, and a screen holding a decrypted copy of one - Passwords - asks the person to decrypt again.
 */
const listeners = new Set<(stores: string[]) => void>();

/*
 * WHAT A SYNC CHANGED STAYS MARKED UNTIL A SCREEN READS IT AGAIN (the A13, 2026-10-25: a password arrived while the
 * Passwords screen was not shown; its store stays open 30 min, so coming back showed the old list and no banner - the
 * mark had lived in the screen). The mark lives here; the screen clears it when it has decrypted again.
 */
const pending = new Set<string>();
export function bucketPending(store: string): boolean {
  return pending.has(store);
}
export function clearBucketPending(store: string): void {
  pending.delete(store);
}

/** Stores a sync just changed (bucket store names, e.g. 'passwords'). */
export function bucketTraded(stores: string[]): void {
  if (!stores.length) return;
  for (const s of stores) pending.add(s);
  for (const l of [...listeners]) {
    try { l(stores); } catch { /* a screen's banner never breaks a sync */ }
  }
}

export function onBucketTraded(listener: (stores: string[]) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

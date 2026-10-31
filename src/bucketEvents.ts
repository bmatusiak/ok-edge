/*
 * A SYNC BROUGHT CHANGES INTO THE BUCKET (Brad, 2026-10-25: "a banner in password tab to tell the user to decrypt the
 * incoming password data from sync, so it can merge into passwords properly").
 *
 * The bucket changes under a screen that already read it: a trade in the identity's room on the user's server takes
 * them in (src/serverRoom.ts - the sync, on every shell, since 2026-10-30). This says which stores changed, and a screen
 * holding a decrypted copy of one - Passwords - asks the person to decrypt again.
 */
const listeners = new Set<(stores: string[]) => void>();

/*
 * WHEN A SYNC LAST CHANGED EACH STORE (the A13, 2026-10-25: a password arrived while the Passwords screen was not shown;
 * its store stays open 30 min, so coming back showed the old list and no banner - the mark had lived in the screen).
 * A screen holding a decrypted copy compares this with when it opened that copy: newer means decrypt again.
 */
const tradedAt = new Map<string, number>();
export function bucketTradedAt(store: string): number {
  return tradedAt.get(store) ?? 0;
}

/** Stores a sync just changed (bucket store names, e.g. 'passwords'). */
export function bucketTraded(stores: string[]): void {
  if (!stores.length) return;
  const at = Date.now();
  for (const s of stores) tradedAt.set(s, at);
  for (const l of [...listeners]) {
    try { l(stores); } catch { /* a screen's banner never breaks a sync */ }
  }
}

export function onBucketTraded(listener: (stores: string[]) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/*
 * A SYNC BROUGHT CHANGES INTO THE BUCKET (Brad, 2026-10-25: "a banner in password tab to tell the user to decrypt the
 * incoming password data from sync, so it can merge into passwords properly").
 *
 * The bucket changes under a screen that already read it: on the phone the trade takes them in (src/bucketTrade.ts);
 * on the desktop the sync service the app hosts does (electron/desktop/sync.js, src/sync.ts). Either way this says
 * which stores changed, and a screen holding a decrypted copy of one - Passwords - asks the person to decrypt again.
 */
const listeners = new Set<(stores: string[]) => void>();

/** Stores a sync just changed (bucket store names, e.g. 'passwords'). */
export function bucketTraded(stores: string[]): void {
  if (!stores.length) return;
  for (const l of [...listeners]) {
    try { l(stores); } catch { /* a screen's banner never breaks a sync */ }
  }
}

export function onBucketTraded(listener: (stores: string[]) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

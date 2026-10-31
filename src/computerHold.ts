/*
 * A COMPUTER'S HOLD ON THE KEY: the desktop's CLI behind the app's socket (src/features/channels/ipc.tsx) holds the key
 * for its whole conversation, and the app's own reads (the Edge tab's sync, the background copy) wait until it lets go.
 *
 * Kept from the phone's Bluetooth vendor bridge, which held the key the same way for a cli-paired computer - that bridge
 * went with the cli pair (Brad, 2026-10-30: "just remove ble pair and sync stuff - we are using key3 to push and sync, so
 * phones are free to become testing over mcp until we rework how ble comes back"). The hold itself was never
 * Bluetooth's: the desktop took it over 2026-10-24 ("1 to 1"), and it is the desktop's alone now.
 */

/* a computer's conversation holds the key's lane until it has been quiet this long (and nothing waits for a press) */
const COMPUTER_QUIET_MS = 1500;

/*
 * A call when a computer lets the key go - for the Edge tab, which syncs once it is free (Brad, 2026-10-06: its reads
 * only queued behind the agent, 6-7 s each).
 */
const freeListeners = new Set<() => void>();
/*
 * All the time a computer has held the key, so far (ms). A sync takes the difference across itself: its log then says
 * how much of it was waiting for a computer's conversation to end - standing aside on purpose - and not its own work
 * (A13, 2026-10-07: "head 2230, vouch 3528" in a burst were the computer's turn).
 */
let heldDone = 0;
let heldFrom: number | null = null;
export function computerHeldMs(): number {
  return heldDone + (heldFrom !== null ? Date.now() - heldFrom : 0);
}
export function onKeyFree(listener: () => void): () => void {
  freeListeners.add(listener);
  return () => {
    freeListeners.delete(listener);
  };
}

/*
 * THE COMPUTER'S HOLD (owner, 2026-10-03: "fix both races"). The lib's lane (node-onlykey-lib src/transport/lane.js)
 * gives the app's own conversations one at a time - Key Chain reads, the background Edge copy, a sign. A computer's
 * writes do not come through that lane, so without this an app request could land in the middle of a computer's push
 * or gpg signature and take its answer.
 *
 * Where a conversation ends cannot be seen - no request ids, multi-report answers, a press of up to 20 s - so the hold
 * lasts until the key has been quiet for COMPUTER_QUIET_MS AND is not waiting for a press, or (sticky) until it is
 * released: the desktop's CLI holds it for its whole connection.
 */
export function createComputerHold(isKeyWaiting?: () => Promise<boolean>) {
  let held: {release: () => void; timer: ReturnType<typeof setTimeout> | null; since: number} | null = null;
  let holding: Promise<void> | null = null;
  function armRelease() {
    if (!held) return;
    if (held.timer) clearTimeout(held.timer);
    held.timer = setTimeout(() => {
      void (async () => {
        if (!held) return;
        const waiting = isKeyWaiting ? await isKeyWaiting().catch(() => false) : false;
        if (waiting) return armRelease(); /* a press is pending: the conversation is not over */
        releaseHold('');
      })();
    }, COMPUTER_QUIET_MS);
  }
  function releaseHold(why: string) {
    if (!held) return;
    if (held.timer) clearTimeout(held.timer);
    const h = held;
    held = null;
    holding = null;
    if (heldFrom !== null) heldDone += Date.now() - heldFrom;
    heldFrom = null;
    h.release();
    /* how long the app's own key reads (the Edge tab's sync) could not get in */
    console.log(`[vendor] the key is free again: the computer held it ${Date.now() - h.since} ms${why}`);
    for (const l of [...freeListeners]) l();
  }
  /* sticky: held until releaseHold - a desktop CLI's whole connection (features/channels/ipc.tsx), not until the key is quiet */
  function holdForComputer(transport: any, sticky = false): Promise<void> {
    if (holding) return holding;
    holding = new Promise<void>(ready => {
      const conversation = () => new Promise<void>(release => {
        held = {release, timer: null, since: Date.now()};
        heldFrom = Date.now();
        console.log('[vendor] the computer holds the key');
        ready();
        if (!sticky) armRelease();
      });
      if (typeof transport.exclusive === 'function') {
        void transport.exclusive(conversation);
      } else {
        void conversation();
      }
    });
    return holding;
  }
  return {armRelease, releaseHold, holdForComputer, isHeld: () => !!held};
}

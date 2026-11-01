/*
 * THE CODE THIS HOST ASKS A HARD KEY FOR (the web app's bucket key, 2026-10-26: the key waited for a 3-button code that
 * nothing showed, so every attempt timed out). When this app is the computer that asks a hard key to sign or derive,
 * the lib works out the 3 digits from the same bytes the key hashes and hands them to `confirm({digits})` - the host
 * showing them is how the challenge is meant to work (the key checks them; CryptoScreen does the same for its slots).
 * The soft key's own press sheet never shows a code (PressSheet.tsx: there the app IS the key); this is the other side.
 *
 * One ask at a time: set while the key waits, cleared when it answered or gave up. HostChallengeSheet.tsx shows it,
 * wherever the person is.
 */
export type HostChallenge = {digits: number[]; what: string};

let current: HostChallenge | null = null;
const listeners = new Set<(c: HostChallenge | null) => void>();

export const hostChallenge = () => current;
export function onHostChallenge(l: (c: HostChallenge | null) => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
function set(c: HostChallenge | null) {
  current = c;
  /*
   * A KEY OUTSIDE THE APP WAITS (a hard key, or the web app's key over WebAuthn): said once, as the soft key's press
   * sheet says its own ("[press] sheet up", PressSheet Locate) - the drive presses that key from the machine holding it
   */
  if (c) console.log(`[press] key waits: ${c.what} - buttons ${c.digits.length ? c.digits.join(' ') : 'any'}`);
  /* and its end - a drive pressing a touch from the key's side must not press inside a code being entered */
  else console.log('[press] key done');
  for (const l of [...listeners]) l(c);
}

/**
 * The lib options for one operation on a hard key that may wait for its code: `confirm` shows the digits, and the
 * returned `done` clears them (call it in a finally).
 */
/**
 * A plain press a hard key waits for, asked by a screen that knows it (the identity check's bucket press - Brad,
 * 2026-10-31: "i was expecting a press sheet, not it being displayed on the identity page"): the sheet with no code;
 * the returned function clears it.
 */
/** The key went away: nothing waits on it any more. */
export function clearHostChallenge(): void {
  if (current) set(null);
}

export function askPress(what: string): () => void {
  set({digits: [], what});
  return () => set(null);
}

export function challengeOpts(what: string): {opts: {confirm: (a: {digits?: number[]}) => void}; done: () => void} {
  return {
    opts: {confirm: ({digits}) => set({digits: Array.isArray(digits) ? digits : [], what})},
    done: () => set(null),
  };
}

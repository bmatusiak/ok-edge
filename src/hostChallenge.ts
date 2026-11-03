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
/* screen: raised by a screen for its whole operation (askPress) - not by the lib at the key's challenge */
/* key: raised for the key's wait with only the request's name (keyAsks) - a screen's own words take its place */
export type HostChallenge = {digits: number[]; what: string; screen?: boolean; key?: boolean};

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
/*
 * A CODE OUTRANKS A SCREEN'S ASK (Brad, 2026-11-02, the Windows web app: the login's bucket key code was set, then the
 * identity check's "Open this identity's bucket" ask replaced it in this one slot - the sheet waited for an Edge press,
 * the code never showed, and the key gave up at 20 s): a screen's ask, raised for its whole operation, waits behind a
 * code the key asks for now, and comes back when the code is done.
 */
let screenAsk: HostChallenge | null = null;

/** The key went away, or answered the screen's press: nothing waits on it any more. */
export function clearHostChallenge(): void {
  screenAsk = null;
  if (current) set(null);
}

export function askPress(what: string): () => void {
  const ask: HostChallenge = {digits: [], what, screen: true};
  screenAsk = ask;
  /*
   * ...and over the key's own wait (keyAsks), which has only the request's name (Brad, 2026-11-03, the login's press sheet
   * read "Edge: opening a budget": "what budget am i pressing for?") - the screen says what it is for; the same sheet
   */
  if (!current || current.screen || current.key) set(ask);
  /* only its own ask: the key's press may have cleared it already (keyBusy), and a later ask is another's */
  return () => {
    if (screenAsk === ask) screenAsk = null;
    if (current === ask) set(null);
  };
}

/*
 * ONE PRESS, ONE SHEET (Brad, 2026-11-03: the card login's one press showed the progress sheet's "Press your OnlyKey",
 * then the login's "Press the key" replaced it in the same second): a key on USB waits for a plain press - this sheet
 * shows it, with the request's words, unless a sheet is up already (a screen's ask raised first stays; one raised after
 * waits in its slot, askPress). keyBusy calls it when the key starts waiting and the returned function when the request
 * ends; the press itself clears it (keyBusy pressed -> clearHostChallenge).
 */
/*
 * THE ASKER SAYS WHY BEFORE IT ASKS (Brad, 2026-11-03: "we already know why we are pressing - the press sheet should always
 * say why"): a screen about to send a request that waits for a press names it first; the press sheet shows those words the
 * moment the key waits (keyAsks) - not the request's bare name until the screen's own ask catches up. One use, 60 s.
 */
let expected: {what: string; until: number} | null = null;
export function expectPress(what: string): void {
  expected = {what, until: Date.now() + 60_000};
}

export function keyAsks(what: string): () => void {
  if (current) return () => undefined;
  const why = expected && Date.now() < expected.until ? expected.what : null;
  expected = null;
  const mine: HostChallenge = {digits: [], what: why ?? what, key: !why};
  set(mine);
  return () => { if (current === mine) set(screenAsk); };
}

/*
 * A COMPUTER'S PRESS, ON THIS APP'S SHEET (Brad, 2026-11-02: red-key's 3-button code for an `onlykey-js agent` sign
 * reached him only through the agent's terminal - the CLI asks the key through this app, so this app shows the code as
 * it shows its own): the CLI's "press asked" (node-onlykey-lib desktop link, src/features/channels/ipc.tsx) with its code,
 * or none for a plain press; the returned function clears it at "press done" or when the CLI goes.
 */
export function computerAsks(what: string, code: string | null | undefined): () => void {
  /*
   * a key on USB only: the soft key's own press sheet asks for its presses, with its button (PressSheet) - a code sheet here
   * too was a second ask, for a hard key that is not there (box, 2026-11-03: the drive tried to press one)
   */
  if (require('./hooks/KeyContext').activeBackend() !== 'usb') return () => undefined;
  const digits = code ? code.split(' ').map(Number).filter(d => d >= 1 && d <= 6) : [];
  const mine: HostChallenge = {digits, what};
  set(mine);
  return () => { if (current === mine) set(screenAsk); };
}

export function challengeOpts(what: string): {opts: {confirm: (a: {digits?: number[]}) => void}; done: () => void} {
  let mine: HostChallenge | null = null;
  return {
    opts: {confirm: ({digits}) => { mine = {digits: Array.isArray(digits) ? digits : [], what}; set(mine); }},
    /* its own code only - then the screen's ask it stood in front of, if that is still wanted */
    done: () => { if (mine && current === mine) set(screenAsk); mine = null; },
  };
}

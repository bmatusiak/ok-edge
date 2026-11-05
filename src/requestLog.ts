/*
 * THE PRESSES THE LIB ASKS, SAID IN THE APP'S LOG (Brad, 2026-11-02: the app knows "what is going to happen BEFORE it
 * will happen"; the rehearsals inspect the sheets against it, not against the key's LED - a hard key does not report its
 * LED, and a release has no drive). The lib's own word (okcrypto 'press', edge.onPress - a CLI's through the desktop
 * link, src/features/channels/ipc.tsx), written here and nowhere near the sheets, so a sheet that fails to show cannot
 * take this line with it. tools/drive/sheets.js reads it.
 */
import {whatOf} from './keyBusy';

export type PressSaid = {phase: 'asked' | 'done'; msg: number; slot: number; ok?: boolean; code?: string | null};

/* the lib's asks still open: while one is, the key's own record of the same press is not said again (sayKeyAsks) */
let libOpen = 0;
export function sayPress(e: PressSaid, from = ''): void {
  libOpen = e.phase === 'asked' ? libOpen + 1 : Math.max(0, libOpen - 1);
  const what = `${whatOf(e.msg, e.slot)}${from ? ` (${from})` : ''}`;
  if (e.phase === 'asked') console.log(`[request] press asked: ${what}${e.code ? ` - code ${e.code}` : ' - a press'}`);
  else console.log(`[request] press done: ${what} - ${e.ok ? 'answered' : 'no answer'}`);
}

/*
 * A PRESS THE KEY ASKED THAT THE LIB DID NOT (the Pixel, 2026-11-05: the login's bucket derive goes "touchless", so the
 * lib says no press - but the soft key's setting, "Web and agent derived keys", asks one, and its sheet rightly showed;
 * with no ask said, the inspector read that sheet as the sign's, stale). The firmware's own derive record says it
 * (pressAsk.ts: the key_chain plugin's "press" ... "press_end"): said here as the key's ask, unless the lib said it.
 */
let keySaid: string | null = null;
export function sayKeyAsks(msg: number, slot: number, code: number[] | null): void {
  if (libOpen || keySaid) return;
  keySaid = `${whatOf(msg, slot)} (the key)`;
  console.log(`[request] press asked: ${keySaid}${code ? ` - code ${code.join(' ')}` : ' - a press'}`);
}
export function sayKeyAskEnded(): void {
  if (!keySaid) return;
  console.log(`[request] press done: ${keySaid} - answered`);
  keySaid = null;
}

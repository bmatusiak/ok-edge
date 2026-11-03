/*
 * THE PRESSES THE LIB ASKS, SAID IN THE APP'S LOG (Brad, 2026-11-02: the app knows "what is going to happen BEFORE it
 * will happen"; the rehearsals inspect the sheets against it, not against the key's LED - a hard key does not report its
 * LED, and a release has no drive). The lib's own word (okcrypto 'press', edge.onPress - a CLI's through the desktop
 * link, src/features/channels/ipc.tsx), written here and nowhere near the sheets, so a sheet that fails to show cannot
 * take this line with it. tools/drive/sheets.js reads it.
 */
import {whatOf} from './keyBusy';

export type PressSaid = {phase: 'asked' | 'done'; msg: number; slot: number; ok?: boolean; code?: string | null};

export function sayPress(e: PressSaid, from = ''): void {
  const what = `${whatOf(e.msg, e.slot)}${from ? ` (${from})` : ''}`;
  if (e.phase === 'asked') console.log(`[request] press asked: ${what}${e.code ? ` - code ${e.code}` : ' - a press'}`);
  else console.log(`[request] press done: ${what} - ${e.ok ? 'answered' : 'no answer'}`);
}

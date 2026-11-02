/*
 * A TAP ON THE SCREEN IS WAITED FOR (Brad, 2026-11-01: "this is not a device press, but need a screen press (but our
 * drive rehearsals dont recognize it)"; "the animated press icon is for device press - so it just needs a signal for our
 * rehearsal flow to get the event to take action"): no icon - one log line when a sheet starts waiting for the person's
 * answer, with its choices: "[tap] wanted: <what> - choices A | B". The drive's rehearsals wait on it (waitForTap) and
 * then tap what the flow says. Nothing taps by itself (Brad's answer: signal only).
 */
import {useEffect} from 'react';

export function useTapWanted(active: boolean, what: string, choices: string[]): void {
  const said = choices.join(' | ');
  useEffect(() => {
    if (active) console.log(`[tap] wanted: ${what} - choices ${said}`);
  }, [active, what, said]);
}

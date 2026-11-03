/*
 * A COMPUTER'S CONVERSATION WITH THE KEY THIS APP HOLDS - one code for every carrier (Brad, 2026-11-01: "reuse the logic
 * that works"; plan B4). The desktop's CLI over the app's local socket (features/channels/ipc.tsx) and a computer's
 * onlykey-js as an accepted agent over the room (keyAgents.ts, the phone) both run the lib's key session
 * (node-onlykey-lib desktop/session.js); what the APP adds is this: the key is the computer's for its whole
 * conversation, and the app's own reads wait.
 *
 *   THE WHOLE CONVERSATION HOLDS THE KEY (box, 2026-10-24: with the Edge tab open, edge setup's certificate came back
 *   with a self-signature that did not verify). A hard key cannot say when it waits for a press - during a press the
 *   line is quiet - so the hold lasts the computer's connection and is let go only to ANSWER that computer's host
 *   messages (the computer is waiting on the answer then, so nothing of its can collide).
 *   HANDED OVER ONLY ONCE THE KEY IS QUIET (box, 2026-10-24, traced): this app's Edge read resolves on its own reports,
 *   but the key keeps sending after it; handed over at once, the computer's first request met that tail. So the hold is
 *   granted when no report has arrived for QUIET_MS, never longer than QUIET_MAX_MS.
 *   THE KEY IT REACHES is the one open now, hard or soft (activeBackend).
 */
import {createComputerHold} from './computerHold';
import {getOnlyKey} from './onlykey';
import {activeBackend} from './hooks/KeyContext';

const QUIET_MS = 400;
const QUIET_MAX_MS = 3000;

export type KeyConversation = {
  /** the computer's connection came (true) or went (false): the key is held for it, or let go */
  /* why: what the computer says this connection is for, in the person's words - its hold's reason on the sheet */
  setConnected(connected: boolean, why?: string): void;
  /** answer one of its host messages: the hold is let go while answering one that uses the key, taken again after */
  answer<T>(fn: () => Promise<T>, usesKey?: boolean): Promise<T>;
  /** before one of its key writes: resolves once the key is the computer's (the session's pipe.beforeWrite) */
  beforeWrite(): Promise<void>;
  /** the carrier stopped (its key is free: the Edge tab syncs) */
  stop(why: string): void;
};

/* who: what holds the key, said on the "Working with your key" sheet while its requests run (computerHold) */
export function createKeyConversation(who = "A computer's command is using your key"): KeyConversation {
  const hold = createComputerHold(undefined, who);
  let connected = false;
  let answering = 0;
  let lastReport = 0;
  let watching = false;
  const quiet = async (transport: any) => {
    if (!watching) { watching = true; transport.on('report', () => { lastReport = Date.now(); }); }
    const until = Date.now() + QUIET_MAX_MS;
    while (Date.now() - lastReport < QUIET_MS && Date.now() < until) await new Promise(r => setTimeout(r, 50));
  };
  let ready: Promise<void> = Promise.resolve();
  /*
   * NO HOLD, NO WRITE (red-key, 2026-11-03: one exec's writes went 50 ms after it connected, no "[hold]" line, the Edge
   * tab's reads in flight - its gpg derive read back wrong and the ship stopped): a hold that could not be taken was
   * swallowed here and the CLI wrote anyway. Now it is said, and the write is refused (the session sends the CLI the
   * error) - the CLI stops cleanly instead of talking over the app.
   */
  const take = () => (ready = getOnlyKey(activeBackend())
    .then(async app => { await hold.holdForComputer(app.transport, connected); await quiet(app.transport); })
    .catch((e: unknown) => {
      console.log(`[hold] could not take the key for the computer: ${String((e as Error)?.message ?? e)}`);
      throw e;
    }));
  return {
    setConnected(c, why) {
      connected = !!c;
      hold.setWho(why ?? who);
      if (connected && !answering) take().catch(() => undefined); /* said in take; its writes are refused */
      if (!connected) hold.releaseHold(' (the computer went away)');
    },
    async answer(fn, usesKey = true) {
      /*
       * AN ANSWER THAT NEVER ASKS THE KEY KEEPS THE HOLD (red-key, 2026-11-03): let go, the app's reads already waiting in
       * the key's lane went in at once - between the CLI's note and its push's SSH sign, which failed. A note and the
       * identity read are storage only (edgeAgents.answerUsesKey); a budget's sheet asks the key for its press.
       */
      if (!usesKey) return fn();
      answering++;
      /* not the conversation's end: the Edge tab's sync waits for the computer to go (computerHold.releaseHold) */
      hold.releaseHold(' (answering the computer)', false);
      try {
        return await fn();
      } finally {
        answering--;
        if (connected && !answering) take().catch(() => undefined);
      }
    },
    async beforeWrite() {
      await (hold.isHeld() ? ready : take().then(() => { if (!connected) hold.armRelease(); }));
      /* the one way through is the hold: a write with none is refused, said (fail closed) */
      if (!hold.isHeld()) {
        console.log('[hold] a computer write with no hold on the key - refused');
        throw new Error('the desktop app could not hand the key over (no hold) - try again');
      }
    },
    stop(why) { hold.releaseHold(why); },
  };
}

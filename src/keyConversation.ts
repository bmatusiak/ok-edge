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
  setConnected(connected: boolean): void;
  /** answer one of its host messages: the hold is let go while answering, taken again after */
  answer<T>(fn: () => Promise<T>): Promise<T>;
  /** before one of its key writes: resolves once the key is the computer's (the session's pipe.beforeWrite) */
  beforeWrite(): Promise<void>;
  /** the carrier stopped */
  stop(why: string): void;
};

export function createKeyConversation(): KeyConversation {
  const hold = createComputerHold();
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
  const take = () => (ready = getOnlyKey(activeBackend())
    .then(async app => { await hold.holdForComputer(app.transport, connected); await quiet(app.transport); })
    .catch(() => undefined));
  return {
    setConnected(c) {
      connected = !!c;
      if (connected && !answering) void take();
      if (!connected) hold.releaseHold(' (the computer went away)');
    },
    async answer(fn) {
      answering++;
      hold.releaseHold(' (answering the computer)');
      try {
        return await fn();
      } finally {
        answering--;
        if (connected && !answering) void take();
      }
    },
    beforeWrite() {
      return hold.isHeld() ? ready : take().then(() => { if (!connected) hold.armRelease(); });
    },
    stop(why) { hold.releaseHold(why); },
  };
}

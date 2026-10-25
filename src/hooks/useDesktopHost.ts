/*
 * THE CLI ON THIS COMPUTER, ANSWERED BY THE PHONE'S OWN HOST (Brad, 2026-10-24: "i need this to be a
 * 1 to 1 in how it works"; "cli -> mobile is the same as cli -> desktopapp"). On the phone a computer's
 * Edge messages come over Bluetooth (useFidoGatt) to edgeAgents.handleEdgeMessage. On the desktop they
 * come over the app's local socket (node-onlykey-lib desktop/serve.js, in electron/desktop/hosting.js)
 * and the main process hands each one here - the same handler, the same request sheet, the same key
 * code (SoftKeyEdge, which on the desktop is the hard key). Nothing on any other shell.
 */
import {useEffect} from 'react';
import {DESKTOP_FROM, handleEdgeMessage} from '../edgeAgents';
import {desktop, shell} from '../platform';
import {createComputerHold} from '../vendorBridge';
import {getOnlyKey} from '../onlykey';

type Shell = {on(channel: string, listener: (payload: any) => void): () => void};

export function useDesktopHost(): void {
  useEffect(() => {
    const bridge = (globalThis as {okedge?: Shell}).okedge;
    if (shell !== 'electron' || !desktop || !bridge) return undefined;
    /*
     * THE CLI'S WHOLE CONVERSATION HOLDS THE KEY (box, 2026-10-24: with the Edge tab open, edge setup's
     * certificate came back with a self-signature that did not verify). The phone's bridge holds the key
     * for a computer until the key is quiet AND not waiting for a press - its soft key says when it waits.
     * A hard key cannot say so: during a press the line is quiet, the hold let go, and the tab's own read
     * landed in the middle of the signature. So on the desktop the hold lasts the CLI's connection
     * (onClient, node-onlykey-lib desktop/serve.js) and is let go only to ANSWER that CLI's host messages -
     * the CLI is waiting on the answer then, so nothing of its can collide.
     */
    const hold = createComputerHold();
    let connected = false;
    let answering = 0;
    /*
     * HANDED OVER ONLY ONCE THE KEY IS QUIET (box, 2026-10-24, traced): this app's Edge read resolves on
     * its own reports, but the key - a debug build most of all - keeps sending after it (text, dumps).
     * Handed over at once, the CLI's first request met that tail: its connect read "0 0 0 0...", a gpg
     * derive came back as someone else's bytes. So the hold is granted when no report has arrived for
     * QUIET_MS (the Edge plugin's own rule before it writes, busQuiet), never longer than QUIET_MAX_MS.
     */
    const QUIET_MS = 400;
    const QUIET_MAX_MS = 3000;
    let lastReport = 0;
    let watching = false;
    const quiet = async (transport: any) => {
      if (!watching) { watching = true; transport.on('report', () => { lastReport = Date.now(); }); }
      const until = Date.now() + QUIET_MAX_MS;
      while (Date.now() - lastReport < QUIET_MS && Date.now() < until) await new Promise(r => setTimeout(r, 50));
    };
    /* the handover in progress: a CLI write waits for it, quiet included */
    let ready: Promise<void> = Promise.resolve();
    const take = () => (ready = getOnlyKey('usb')
      .then(async app => { await hold.holdForComputer(app.transport, connected); await quiet(app.transport); })
      .catch(() => undefined));
    const offConnected = bridge.on('okedge:computerConnected', ({connected: c}: {connected: boolean}) => {
      connected = !!c;
      if (connected && !answering) void take();
      if (!connected) hold.releaseHold(' (the CLI went away)');
    });
    const offMessage = bridge.on('okedge:edgeMessage', ({id, message, from}: {id: number; message: unknown; from: string}) => {
      answering++;
      hold.releaseHold(' (answering the CLI)');
      void handleEdgeMessage(message, `${DESKTOP_FROM}${from}`)
        .catch((e: unknown) => ({ok: false, refusal: 'invalid', detail: `the desktop app could not answer: ${String((e as Error)?.message ?? e)}`}))
        .then(answer => desktop!.invoke('okedge:edgeAnswer', id, answer ?? null))
        .finally(() => {
          answering--;
          if (connected && !answering) void take();
        });
    });
    /*
     * THE CLI IS ABOUT TO WRITE TO THE KEY: held already for its connection, said at once; otherwise taken
     * first - after this app's own request in flight (vendorBridge createComputerHold) - then said.
     */
    const offTalks = bridge.on('okedge:computerTalks', ({id}: {id: number}) => {
      void (hold.isHeld() ? ready : take().then(() => { if (!connected) hold.armRelease(); }))
        .then(() => desktop!.invoke('okedge:computerHeld', id));
    });
    return () => { offConnected(); offMessage(); offTalks(); hold.releaseHold(' (the desktop host stopped)'); };
  }, []);
}

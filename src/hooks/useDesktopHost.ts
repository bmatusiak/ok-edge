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

type Shell = {on(channel: string, listener: (payload: any) => void): () => void};

export function useDesktopHost(): void {
  useEffect(() => {
    const bridge = (globalThis as {okedge?: Shell}).okedge;
    if (shell !== 'electron' || !desktop || !bridge) return undefined;
    return bridge.on('okedge:edgeMessage', ({id, message, from}: {id: number; message: unknown; from: string}) => {
      void handleEdgeMessage(message, `${DESKTOP_FROM}${from}`)
        .catch((e: unknown) => ({ok: false, refusal: 'invalid', detail: `the desktop app could not answer: ${String((e as Error)?.message ?? e)}`}))
        .then(answer => desktop!.invoke('okedge:edgeAnswer', id, answer ?? null));
    });
  }, []);
}

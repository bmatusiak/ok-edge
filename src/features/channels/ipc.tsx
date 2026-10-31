/*
 * THE DESKTOP'S PIPE TO THE CLI (>_) - a channel like Bluetooth and the MCP (Brad, 2026-10-30: "the activity for
 * desktop has IPC for its communication, and it's not listed as an activity icon or panel, so that needs to be added").
 * The CLI on this computer reaches the desktop app through its local pipe (node-onlykey-lib desktop/serve.js, in
 * electron/desktop/hosting.js), and the app answers it with the Edge host (edgeAgents). This feature is in the desktop's
 * list only (src/features/list.desktop.ts), so nothing here asks which shell it is.
 *
 * Its icon: grey - no CLI connected; green - a CLI is connected (its whole conversation holds the key); purple flashing -
 * its requests crossing (btActivity 'ipc'). Its card: connected or not, the last request and from where.
 *
 * The host itself (below, as src/hooks/useDesktopHost.ts had it):
 *   THE CLI ON THIS COMPUTER, ANSWERED BY THE PHONE'S OWN HOST (Brad, 2026-10-24: "i need this to be a
 *   1 to 1 in how it works"; "cli -> mobile is the same as cli -> desktopapp"). The phone's Bluetooth
 *   link to a computer went with the cli pair (2026-10-30, until Bluetooth comes back redesigned); the
 *   Edge host it used is this one's: the CLI's messages come over the app's local socket (node-onlykey-lib
 *   desktop/serve.js, in electron/desktop/hosting.js) and the main process hands each one here - to
 *   edgeAgents.handleEdgeMessage, the request sheet and the key code (SoftKeyEdge, which on the desktop is
 *   the hard key). Nothing on any other shell.
 */
import React, {useEffect, useState} from 'react';
import {Pressable, Text} from 'react-native';
import {DESKTOP_FROM, handleEdgeMessage} from '../../edgeAgents';
import {desktop} from '../../platform';
import {createComputerHold} from '../../computerHold';
import {getOnlyKey} from '../../onlykey';
import {activeBackend} from '../../hooks/KeyContext';
import {ioPulse} from '../../btActivity';
import {theme} from '../../ui/theme';
import {Btn, Section} from '../../ui/components';
import {barStyles, useIoPurple} from '../../ui/statusBar';
import type {AppWatch} from '../../plugins/types';
import {Row, ago, lastOf, useNow} from './rows';
import {channelPlugin} from './plugin';

/* what the pipe is doing now: a CLI connected, and its last request */
type CliState = {connected: boolean; last: {at: number; from: string; what: string} | null};
let cli: CliState = {connected: false, last: null};
const seen = new Set<(s: CliState) => void>();
const setCli = (patch: Partial<CliState>) => { cli = {...cli, ...patch}; for (const f of seen) f(cli); };
function useCli(): CliState {
  const [s, setS] = useState(cli);
  useEffect(() => { seen.add(setS); return () => { seen.delete(setS); }; }, []);
  return s;
}

type Shell = {on(channel: string, listener: (payload: any) => void): () => void};

function useDesktopHost(): void {
  useEffect(() => {
    const bridge = (globalThis as {okedge?: Shell}).okedge;
    if (!desktop || !bridge) return undefined;
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
    /*
     * the handover in progress: a CLI write waits for it, quiet included. THE KEY THE CLI REACHES - the open one,
     * hard or soft (electron/desktop/hosting.js follows the same activeKey): held as 'usb' always, the soft key went
     * on answering this page's own reads while a CLI talked to it, and the CLI read them as its answers (the Windows
     * desktop, 2026-10-25: a bucket key's ECDH "answered" with no press, its certificate did not verify).
     */
    let ready: Promise<void> = Promise.resolve();
    const take = () => (ready = getOnlyKey(activeBackend())
      .then(async app => { await hold.holdForComputer(app.transport, connected); await quiet(app.transport); })
      .catch(() => undefined));
    const offConnected = bridge.on('okedge:computerConnected', ({connected: c}: {connected: boolean}) => {
      connected = !!c;
      setCli({connected});
      if (connected && !answering) void take();
      if (!connected) hold.releaseHold(' (the CLI went away)');
    });
    const offMessage = bridge.on('okedge:edgeMessage', ({id, message, from}: {id: number; message: unknown; from: string}) => {
      ioPulse('ipc');
      setCli({last: {at: Date.now(), from, what: String((message as {type?: unknown})?.type ?? 'a message')}});
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
     * first - after this app's own request in flight (src/computerHold.ts) - then said.
     */
    const offTalks = bridge.on('okedge:computerTalks', ({id}: {id: number}) => {
      ioPulse('ipc');
      void (hold.isHeld() ? ready : take().then(() => { if (!connected) hold.armRelease(); }))
        .then(() => desktop!.invoke('okedge:computerHeld', id));
    });
    return () => { offConnected(); offMessage(); offTalks(); hold.releaseHold(' (the desktop host stopped)'); };
  }, []);
}

const HostWatch: AppWatch = () => {
  useDesktopHost();
  return null;
};

function IpcStatus({onPress}: {onPress: () => void}) {
  const s = useCli();
  const io = useIoPurple(c => c === 'ipc', false);
  const color = io ? theme.io : s.connected ? theme.ok : theme.textDim;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="CLI status"
      style={({pressed}) => [barStyles.barMid, pressed && barStyles.pressed]}>
      <Text style={[barStyles.barIcon, {color}]}>{'>_'}</Text>
    </Pressable>
  );
}

function IpcCard({openTab}: {openTab: (name: string) => void}) {
  const s = useCli();
  const now = useNow();
  return (
    <Section title=">_  CLI on this computer">
      <Row label="the CLI's pipe" value={s.connected ? 'a CLI is connected - it holds the key while it talks' : 'no CLI connected'} />
      <Row label="its last request" value={s.last ? `${ago(s.last.at, now)} - ${s.last.what} from ${s.last.from}` : 'none since the app started'} />
      <Row label="pipe traffic" value={lastOf('ipc', now)} />
      <Btn title="Edge" onPress={() => openTab('Edge')} />
    </Section>
  );
}

export const ipcChannel = channelPlugin({
  name: 'CLI', order: 40,
  icon: ctx => <IpcStatus onPress={() => ctx.openTab('Activity')} />,
  card: ctx => <IpcCard openTab={ctx.openTab} />,
}, HostWatch);

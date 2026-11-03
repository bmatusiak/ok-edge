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
import {createKeyConversation} from '../../keyConversation';
import {ioPulse} from '../../btActivity';
import {keyGone, noteEdgeRequest, noteTunnel} from '../../keyBusy';
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
     * THE CLI'S WHOLE CONVERSATION HOLDS THE KEY, handed over only once it is quiet - src/keyConversation.ts (the same
     * one a computer's agent gets on the phone, keyAgents.ts). The CLI's bytes cross in the main process
     * (electron/desktop/hosting.js runs the lib's key session); this page holds the key for it and answers its host
     * messages.
     */
    const conv = createKeyConversation();
    const offConnected = bridge.on('okedge:computerConnected', ({connected: c}: {connected: boolean}) => {
      setCli({connected: !!c});
      conv.setConnected(!!c);
    });
    const offMessage = bridge.on('okedge:edgeMessage', ({id, message, from}: {id: number; message: unknown; from: string}) => {
      ioPulse('ipc');
      setCli({last: {at: Date.now(), from, what: String((message as {type?: unknown})?.type ?? 'a message')}});
      void conv.answer(() => handleEdgeMessage(message, `${DESKTOP_FROM}${from}`))
        .catch((e: unknown) => ({ok: false, refusal: 'invalid', detail: `the desktop app could not answer: ${String((e as Error)?.message ?? e)}`}))
        .then(answer => desktop!.invoke('okedge:edgeAnswer', id, answer ?? null));
    });
    /*
     * THE CLI IS ABOUT TO WRITE TO THE KEY: held already for its connection, said at once; otherwise taken
     * first - after this app's own request in flight (src/computerHold.ts) - then said.
     */
    const offTalks = bridge.on('okedge:computerTalks', ({id}: {id: number}) => {
      ioPulse('ipc');
      void conv.beforeWrite().then(() => desktop!.invoke('okedge:computerHeld', id));
    });
    /*
     * THE CLI'S REQUESTS ON THIS APP'S SHEET (Brad, 2026-11-02: the agent identity's certificate waited for a press with no
     * sheet): the CLI says each request's progress (node-onlykey-lib cli/transport-desktop.js tell), and it is shown as this
     * app's own - the progress, then "Press your OnlyKey" while the key waits. A CLI gone mid-request takes its sheet.
     */
    const offBusy = bridge.on('okedge:computerBusy', ({kind, e}: {kind: string; e: any}) => {
      if (kind === 'tunnel') noteTunnel({...e, via: 'direct'});
      else if (kind === 'edge') noteEdgeRequest(e);
      else keyGone();
    });
    return () => { offConnected(); offMessage(); offTalks(); offBusy(); conv.stop(' (the desktop host stopped)'); };
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

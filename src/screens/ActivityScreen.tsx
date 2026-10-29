/*
 * THE ACTIVITY TAB (Brad, 2026-10-29: "a single activity panel, containing all icons so they're not spaced or
 * separated - a press on any icon takes you to the same panel now, 'activity'; the activity panel for each icon section
 * shows activity info for it, and has a button to their respective tab").
 *
 * One section per status icon this device shows in the top bar, in the bar's order - the phone's radio icons (ᛒ ⌨ ⚿),
 * then sync (⇄) and the MCP (🔗) on every platform. Each says the icon's state in words, its last activity (btActivity's
 * ioLast: when its traffic last flashed, and how often since the app started) and leads to the tab that icon summarises.
 * One code for every shell: a section a shell has no icon for is not drawn.
 */
import React, {useEffect, useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {Btn, Section} from '../ui/components';
import {theme} from '../ui/theme';
import {shell} from '../platform';
import {ioLast, onIo, type IoChannel} from '../btActivity';
import {useSync} from '../sync';
import {onRoomState, roomState, type RoomState} from '../serverRoom';
import {agentsState, onAgents, type AgentsState} from '../mcpAgents';

/* the phone's Bluetooth, as the bar's radio icons read it (PhoneApp RadioStatus) */
export type BtActivity = {on: boolean; fido: string; keyboard: string};

const ago = (at: number | undefined | null, now: number): string => {
  if (!at) return 'none since the app started';
  const s = Math.max(0, Math.round((now - at) / 1000));
  return s < 60 ? `${s} s ago` : s < 3600 ? `${Math.round(s / 60)} min ago` : new Date(at).toLocaleTimeString();
};
const lastOf = (c: IoChannel, now: number): string => {
  const l = ioLast(c);
  return l ? `${ago(l.at, now)} (${l.count} since the app started)` : 'none since the app started';
};

function Row({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export function ActivityScreen({bt, onOpen}: {bt: BtActivity | null; onOpen: (tab: string) => void}) {
  const s = useSync();
  const [room, setRoom] = useState<RoomState>(roomState());
  const [agents, setAgents] = useState<AgentsState>(agentsState());
  /* the "last activity" lines move with the traffic and the clock */
  const [now, setNow] = useState(Date.now());
  useEffect(() => onRoomState(setRoom), []);
  useEffect(() => onAgents(setAgents), []);
  useEffect(() => onIo(() => setNow(Date.now())), []);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(t); }, []);

  const pending = agents.agents.filter(a => a.state === 'pending').length;
  const syncWords = s && s.enabled
    ? (s.service === 'running' ? 'on' : s.service === 'no-peers' ? 'on - nothing paired to sync with' : s.service === 'elsewhere' ? `run by ${s.elsewhere ?? 'another program'}` : s.service)
    : s ? 'turned off' : 'no sync service on this platform - the server\'s room only';
  const roomWords = room.status === 'joined' ? `in the room on ${room.url ? new URL(room.url).host : 'its server'}`
    : room.status === 'joining' ? 'joining'
    : room.status === 'error' ? `not joined - ${room.why ?? 'see the Server panel'}`
    : room.url ? 'not joined' : 'no server (the key names none)';

  return (
    <ScrollView contentContainerStyle={styles.page}>
      {bt ? (
        <Section title="ᛒ ⌨ ⚿  Bluetooth">
          <Row label="radio" value={bt.on ? 'on' : 'off'} />
          <Row label="key service (⚿)" value={bt.fido} />
          <Row label="keyboard (⌨)" value={bt.keyboard} />
          <Row label="key traffic" value={lastOf('key', now)} />
          <Row label="keystrokes" value={lastOf('keyboard', now)} />
          <Btn title="Bluetooth" onPress={() => onOpen('Bluetooth')} />
        </Section>
      ) : null}

      <Section title="⇄  Sync">
        <Row label="sync service" value={syncWords} />
        {s?.last ? <Row label="its last sync" value={`${ago(s.last.at, now)} - ${s.last.line}`} /> : null}
        {room.last ? <Row label="last trade in the room" value={`${ago(room.last.at, now)} with ${room.last.with} - ${room.last.line}`} /> : null}
        <Row label="trade traffic" value={lastOf('sync', now)} />
        <Btn title="Sync" onPress={() => onOpen('Sync')} />
      </Section>

      <Section title={'\u{1F517}︎  MCP'}>
        <Row label="server room" value={roomWords} />
        <Row label="agents" value={agents.online ? `${agents.agents.length} (${pending} waiting for you), ${agents.plans.length} plan(s)` : 'not reachable from here now'} />
        <Row label="agent messages" value={lastOf('mcp', now)} />
        <View style={styles.buttons}>
          <Btn title="Edge (agents)" onPress={() => onOpen('Edge')} />
          <Btn title="Server" onPress={() => onOpen('Sync')} />
        </View>
      </Section>
      {shell === 'webapp' ? <Text style={styles.note}>The web app reaches its other devices through the server's room only.</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {padding: 16, gap: 12},
  row: {flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 3},
  label: {color: theme.textDim, fontSize: 13},
  value: {color: theme.text, fontSize: 13, flexShrink: 1, textAlign: 'right'},
  buttons: {flexDirection: 'row', gap: 8, marginTop: 6},
  note: {color: theme.textDim, fontSize: 12, paddingHorizontal: 4},
});

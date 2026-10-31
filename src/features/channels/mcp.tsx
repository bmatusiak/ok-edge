/*
 * THE MCP CHANNEL (🔗): the server's room - where agents reach this identity, and where its devices sync - its icon and
 * its Activity card, every platform.
 */
import React, {useEffect, useState} from 'react';
import {Pressable, Text, View} from 'react-native';
import {theme} from '../../ui/theme';
import {Btn, Section} from '../../ui/components';
import {barStyles, useIoPurple} from '../../ui/statusBar';
import {agentsState, onAgents, type AgentsState} from '../../mcpAgents';
import {Row, ago, lastOf, rowStyles, useNow} from './rows';
import {useRoom} from '../../hooks/useRoom';
import {channelPlugin} from './plugin';

const styles = barStyles;

/*
 * 🔗 THE MCP (Brad, 2026-10-29: "i want 🔗 for the MCP (enabled/activity colors like other icons)"): the server's room,
 * where the agents asking this identity reach it (mcpAgents.ts). Grey - no server; yellow - joining, or not joined (the
 * Server panel says why); green - in the room; purple flashing - room traffic (btActivity 'mcp'): an agent's message
 * arriving, and since 2026-10-30 every trade message and sealed-copy round too. Drawn as text (U+FE0E asks for the plain
 * glyph, so it takes the colour like ᛒ ⌨ ⚿ - where a platform still draws the emoji, the bar under it carries the
 * colour). It leads to the Activity tab, whose card leads on to the Sync tab, where the Server panel is.
 *
 * THE SYNC'S ICON TOO (Brad, 2026-10-30: "just remove ble pair and sync stuff - we are using key3 to push and sync, so
 * phones are free to become testing over mcp until we rework how ble comes back"; the ⇄ goes, 🔗 is the sync's icon
 * now). The room is the sync on every shell (src/serverRoom.ts), so its colours stay the room's: what the ⇄ showed
 * beside them - the Bluetooth sync and the desktop's sync service - went. What it showed of the room, its last trade,
 * is on this card.
 */
function McpStatus({onPress}: {onPress: () => void}) {
  const room = useRoom();
  const io = useIoPurple(c => c === 'mcp', false);
  const color = io ? theme.io
    : room.status === 'joined' ? theme.ok
    : room.status === 'joining' || room.status === 'error' ? theme.warn
    : theme.textDim;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="MCP status"
      style={({pressed}) => [styles.barMid, pressed && styles.pressed]}>
      <Text style={[styles.barIcon, {color, borderBottomWidth: 2, borderBottomColor: color}]}>{'\u{1F517}︎'}</Text>
    </Pressable>
  );
}

function McpCard({openTab}: {openTab: (name: string) => void}) {
  const room = useRoom();
  const now = useNow();
  const [agents, setAgents] = useState<AgentsState>(agentsState());
  useEffect(() => onAgents(setAgents), []);
  const pending = agents.agents.filter(a => a.state === 'pending').length;
  const roomWords = room.status === 'joined' ? `in the room on ${room.url ? new URL(room.url).host : 'its server'}`
    : room.status === 'joining' ? 'joining'
    : room.status === 'error' ? `not joined - ${room.why ?? 'see the Server panel'}`
    : room.url ? 'not joined' : 'no server (the key names none)';
  return (
    <Section title={'\u{1F517}︎  MCP'}>
      <Row label="server room" value={roomWords} />
      {room.last ? <Row label="last trade in the room" value={`${ago(room.last.at, now)} with ${room.last.with} - ${room.last.line}`} /> : null}
      <Row label="agents" value={agents.online ? `${agents.agents.length} (${pending} waiting for you), ${agents.plans.length} plan(s)` : 'not reachable from here now'} />
      <Row label="room traffic (agents, trades)" value={lastOf('mcp', now)} />
      <View style={rowStyles.buttons}>
        <Btn title="Edge (agents)" onPress={() => openTab('Edge')} />
        <Btn title="Sync" onPress={() => openTab('Sync')} />
      </View>
    </Section>
  );
}

export const mcpChannel = channelPlugin({
  name: 'MCP', order: 30,
  icon: ctx => <McpStatus onPress={() => ctx.openTab('Activity')} />,
  card: ctx => <McpCard openTab={ctx.openTab} />,
});

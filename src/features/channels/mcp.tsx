/* THE MCP CHANNEL (🔗): the server's room, where agents reach this identity - its icon and its Activity card, every platform */
import React, {useEffect, useState} from 'react';
import {Pressable, Text, View} from 'react-native';
import {theme} from '../../ui/theme';
import {Btn, Section} from '../../ui/components';
import {barStyles, useIoPurple} from '../../ui/statusBar';
import {agentsState, onAgents, type AgentsState} from '../../mcpAgents';
import {Row, lastOf, rowStyles, useNow} from './rows';
import {useRoom} from './sync';
import {channelPlugin} from './plugin';

const styles = barStyles;

/*
 * 🔗 THE MCP (Brad, 2026-10-29: "i want 🔗 for the MCP (enabled/activity colors like other icons)"): the server's room,
 * where the agents asking this identity reach it (mcpAgents.ts). Grey - no server; yellow - joining, or not joined (the
 * Server panel says why); green - in the room; purple flashing - an agent's message arriving (btActivity 'mcp'). Drawn
 * as text (U+FE0E asks for the plain glyph, so it takes the colour like ᛒ ⌨ ⚿ - where a platform still draws the
 * emoji, the bar under it carries the colour). It leads to the Sync tab, where the Server panel is.
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
      <Row label="agents" value={agents.online ? `${agents.agents.length} (${pending} waiting for you), ${agents.plans.length} plan(s)` : 'not reachable from here now'} />
      <Row label="agent messages" value={lastOf('mcp', now)} />
      <View style={rowStyles.buttons}>
        <Btn title="Edge (agents)" onPress={() => openTab('Edge')} />
        <Btn title="Server" onPress={() => openTab('Sync')} />
      </View>
    </Section>
  );
}

export const mcpChannel = channelPlugin({
  name: 'MCP', order: 30,
  icon: ctx => <McpStatus onPress={() => ctx.openTab('Activity')} />,
  card: ctx => <McpCard openTab={ctx.openTab} />,
});

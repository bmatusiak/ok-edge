/**
 * THE AGENTS on the Edge tab (the MCP plan, Step 4; Brad, 2026-10-29, picked: "Agents list, plan inline"): every AI
 * agent that asked this identity on the server's /mcp, newest last, each with its word from the owner - pending,
 * accepted, blocked - and its plan as it grows, item by item, live (src/mcpAgents.ts).
 *
 *   pending   [Accept] [Block]      the agent is new here: nothing it plans can be submitted until it is accepted
 *   accepted  [Block] [Remove]      its plans can be submitted; each still needs Approve and a press (the Edge sheet)
 *   blocked   [Remove]              its plans are not shown; Remove forgets it (it would ask again as pending)
 *
 * A plan's items read as the owner will approve them: what (sign / decrypt), with which key, why, and - for a
 * placeholder - "data to come". Results show under their item once the plan runs.
 */
import React, {useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {agentsState, onAgents, setAgent, type Agent, type Plan, type PlanItem} from '../mcpAgents';
import {Btn} from './components';
import {theme} from './theme';

const STATE_WORD: Record<Plan['state'], string> = {
  draft: 'being written',
  submitted: 'waiting for your approval',
  running: 'running',
  paused: 'waiting for the agent',
  done: 'done',
  declined: 'declined',
  failed: 'failed',
  ended: 'ended',
};

function ItemRow({item, result}: {item: PlanItem; result?: Plan['results'][string]}) {
  const what = `${item.item}  ${item.op}  ${item.key.kind} ${item.key.identity}`;
  const outcome = !result ? null : result.refusal ? `refused: ${result.refusal}` : result.signature ? 'signed ✓' : result.plaintext !== undefined ? 'decrypted ✓' : null;
  return (
    <View style={styles.item}>
      <Text style={styles.mono} numberOfLines={1}>{what}</Text>
      <Text style={styles.dim}>{`"${item.reason}"${item.data === null ? ' · data to come' : ''}`}</Text>
      {outcome ? <Text style={[styles.dim, {color: result?.refusal ? theme.error : theme.ok}]}>{outcome}</Text> : null}
    </View>
  );
}

function AgentRow({agent, plans}: {agent: Agent; plans: Plan[]}) {
  const [busy, setBusy] = useState(false);
  const [why, setWhy] = useState<string | null>(null);
  const act = (s: 'accepted' | 'blocked' | 'removed') => {
    setBusy(true);
    setWhy(null);
    setAgent(agent.id, s).catch((e: Error) => setWhy(e.message)).finally(() => setBusy(false));
  };
  const stateColor = agent.state === 'accepted' ? theme.ok : agent.state === 'blocked' ? theme.error : theme.warn;
  return (
    <View style={styles.agent}>
      <View style={styles.row}>
        <Text style={styles.name}>{agent.name}</Text>
        <Text style={[styles.state, {color: stateColor}]}>{agent.state}</Text>
        <View style={{flex: 1}} />
        {agent.state === 'pending' ? <Btn title="Accept" tone="primary" onPress={() => act('accepted')} disabled={busy} /> : null}
        {agent.state !== 'blocked' ? <Btn title="Block" tone="danger" onPress={() => act('blocked')} disabled={busy} /> : null}
        {agent.state !== 'pending' ? <Btn title="Remove" onPress={() => act('removed')} disabled={busy} /> : null}
      </View>
      <Text style={styles.dim}>{`agent ${agent.id.slice(0, 12)}…${agent.first ? ` · first seen ${new Date(agent.first).toLocaleString()}` : ''}`}</Text>
      {why ? <Text style={[styles.dim, {color: theme.error}]}>{why}</Text> : null}
      {agent.state === 'blocked' ? null : plans.map(p => (
        <View key={p.id} style={styles.plan}>
          <Text style={styles.planTitle}>{`Plan: ${p.title}`}</Text>
          <Text style={styles.dim}>{`${STATE_WORD[p.state] ?? p.state} · ${p.items.length} item${p.items.length === 1 ? '' : 's'}${p.why ? ` · ${p.why}` : ''}`}</Text>
          {p.items.map(it => <ItemRow key={it.item} item={it} result={p.results?.[String(it.item)]} />)}
        </View>
      ))}
    </View>
  );
}

/* what to give an agent: the address and the identity public key (selectable, to copy) */
function GiveAnAgent({identityPublicKey}: {identityPublicKey: string}) {
  const origin = typeof location !== 'undefined' ? location.origin : null;
  return (
    <View style={styles.give}>
      <Text style={styles.dim}>Give an AI agent these two - its plans show here as it writes them:</Text>
      {origin ? <Text selectable style={styles.mono}>{`${origin}/mcp`}</Text> : null}
      <Text selectable style={styles.mono}>{identityPublicKey}</Text>
    </View>
  );
}
declare const location: {origin: string} | undefined;

export function AgentsCard() {
  const [s, setS] = useState(agentsState());
  useEffect(() => onAgents(setS), []);
  if (!s.online) {
    return <View style={styles.card}><Text style={styles.dim}>Not connected to your server now - agents show here once this device is in its room.</Text></View>;
  }
  return (
    <View style={styles.card}>
      {s.identityPublicKey ? <GiveAnAgent identityPublicKey={s.identityPublicKey} /> : null}
      {s.agents.length ? null : <Text style={styles.dim}>No agent has asked yet.</Text>}
      {s.agents.map(a => <AgentRow key={a.id} agent={a} plans={s.plans.filter(p => p.agent.id === a.id)} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {gap: 10, paddingVertical: 4},
  give: {gap: 2},
  agent: {gap: 4, padding: 10, borderRadius: theme.radius, backgroundColor: theme.surfaceAlt},
  row: {flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap'},
  name: {color: theme.text, fontSize: theme.fontSize, fontWeight: '600'},
  state: {fontSize: 13},
  plan: {gap: 2, marginTop: 6, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: theme.warn},
  planTitle: {color: theme.text, fontSize: 14, fontWeight: '600'},
  item: {gap: 0, paddingVertical: 2},
  mono: {color: theme.text, fontFamily: theme.mono, fontSize: 13},
  dim: {color: theme.textDim, fontSize: 13},
});

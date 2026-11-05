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
import {Btn, Segmented} from './components';
import {localMcpUrl} from '../localMcp';
import NativeSecrets from 'okedge-native/specs/NativeSecrets';
import {CLIPBOARD_TTL_MS} from './sensitive';
import {theme} from './theme';

const STATE_WORD: Record<Plan['state'], string> = {
  draft: 'being written',
  submitted: 'waiting for your approval',
  running: 'running - its data comes now',
  done: 'done',
  declined: 'declined',
  failed: 'failed',
  ended: 'ended',
};

function ItemRow({item, result}: {item: PlanItem; result?: Plan['results'][string]}) {
  /* an RSA item as the agent named it: its certificate (the slot is this device's, set only when it runs - mcpPlans) */
  const what = `${item.item}  ${item.op}  ${item.key.kind === 'rsa' ? `RSA key of certificate ${String(item.key.cert || '').slice(0, 16).toUpperCase()}…` : `${item.key.kind} ${item.key.identity}`}`;
  const outcome = !result ? null : result.refusal ? `refused: ${result.refusal}` : result.signature ? 'signed ✓' : result.plaintext !== undefined ? 'decrypted ✓' : null;
  return (
    <View style={styles.item}>
      <Text style={styles.mono} numberOfLines={1}>{what}</Text>
      {/* a plan the room kept from before fingerprints (2026-11-04) has none: its row still draws */}
      <Text style={styles.dim}>{`"${item.reason}"${item.fingerprint ? ` · ${item.fingerprint.slice(0, 16)}` : ''}`}</Text>
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
        {/* each labelled with its agent (the drive taps "Accept <name>" - 2026-11-01: a flow accepted another room's agent, both rows saying just "Accept") */}
        {agent.state === 'pending' ? <Btn title="Accept" label={`Accept ${agent.name}`} tone="primary" onPress={() => act('accepted')} disabled={busy} /> : null}
        {agent.state !== 'blocked' ? <Btn title="Block" label={`Block ${agent.name}`} tone="danger" onPress={() => act('blocked')} disabled={busy} /> : null}
        {agent.state !== 'pending' ? <Btn title="Remove" label={`Remove ${agent.name}`} onPress={() => act('removed')} disabled={busy} /> : null}
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

/*
 * WHAT TO GIVE AN AGENT: the address and the identity public key. LOCAL | REMOTE (Brad, 2026-11-05: "put a local | remote
 * selector tab, and a copy button to make it easy to copy to clipboard"): Local is this computer's own MCP (the desktop
 * app's, on its loopback - an agent running on this computer, the release signer's `--server local`); Remote is your
 * server's (an agent anywhere - the release workflow). The tab shows only where both exist. Copied as the app copies.
 */
function GiveAnAgent({identityPublicKey}: {identityPublicKey: string}) {
  const local = localMcpUrl();
  const remote = typeof location !== 'undefined' ? `${location.origin}/mcp` : null;
  const [where, setWhere] = useState<'Local' | 'Remote'>(local ? 'Local' : 'Remote');
  const [copied, setCopied] = useState<string | null>(null);
  const address = where === 'Local' && local ? `${local.replace(/\/$/, '')}/mcp` : remote;
  const copy = (text: string, what: string) => {
    NativeSecrets.copySensitive(text, CLIPBOARD_TTL_MS).then(() => setCopied(`${what} copied`), (e: unknown) => setCopied(String((e as Error)?.message ?? e)));
  };
  return (
    <View style={styles.give}>
      <Text style={styles.dim}>Give an AI agent these two - its plans show here as it writes them:</Text>
      {local && remote ? <Segmented options={['Local', 'Remote'] as const} value={where} onChange={w => { setWhere(w); setCopied(null); }} /> : null}
      {local && remote ? (
        <Text style={styles.dim}>{where === 'Local' ? 'this computer only - an agent running here' : 'your server - an agent anywhere'}</Text>
      ) : null}
      {address ? (
        <View style={styles.giveRow}>
          <Text selectable style={[styles.mono, styles.giveText]}>{address}</Text>
          <Btn title="Copy" label={`Copy the ${where.toLowerCase()} address`} onPress={() => copy(address, 'Address')} />
        </View>
      ) : null}
      <View style={styles.giveRow}>
        <Text selectable style={[styles.mono, styles.giveText]}>{identityPublicKey}</Text>
        <Btn title="Copy" label="Copy the identity public key" onPress={() => copy(identityPublicKey, 'Identity public key')} />
      </View>
      {/* both at once (Brad, 2026-11-05: "I should have a copy button to copy both"), labelled as an agent reads them */}
      {address ? (
        <Btn title="Copy both" tone="primary" label={`Copy the ${where.toLowerCase()} address and the identity public key`}
          onPress={() => copy(`MCP server: ${address}\nidentity public key: ${identityPublicKey}`, 'Both')} />
      ) : null}
      {copied ? <Text style={styles.dim}>{copied}</Text> : null}
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
  giveRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  giveText: {flex: 1},
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

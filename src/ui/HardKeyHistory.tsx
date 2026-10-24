import React, {useCallback, useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {Btn} from './components';
import {theme} from './theme';
import {desktop} from '../platform';

/*
 * THE HARD KEY'S BUDGET HISTORY, ON THE DESKTOP (Brad, 2026-10-24: "budget history? the block chain
 * storage should be loaded by the desktop app ... history from budgets i approved earlier is not
 * showing up"). The main process reads the CLI's copy of this key's chain from the shared records
 * (~/.onlykey-js) and the lib tells it as budgets (edge/src/history.js): what each one approved,
 * each use with its intent and receipt, how it ended. This chain only for now; the other devices of
 * the same key identity join it with "my device name" and its statement (TODO B3).
 *
 * The reasons, intents and receipt messages are the agent's own text: shown quoted, as text.
 */

type Receipt = {seq: number; name: string; message: string | null} | null;
type Spend = {seq: number; op: string; slot: number; step: number; intent: string | null; receipt: Receipt};
type Budget = {
  grantId: number; seq: number | null; reason: string | null; uses: number | null; lifetime: number;
  opened: number | null; from: string | null; scopes: {identity?: string; cap: number}[];
  spends: Spend[]; ended: {seq: number; how: string} | null;
};
type History = {budgets: Budget[]; presses: {seq: number; op: string; intent: string | null; receipt: Receipt}[]; losses: {seq: number; from: number; to: number}[]};
type Answer = {deviceId?: string; net?: string | null; links?: number; history?: History | null; error?: string};

const when = (ms: number | null) => (ms ? new Date(ms).toLocaleString() : 'time not kept');

export function HardKeyHistory() {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!desktop) return;
    setBusy(true);
    try {
      setAnswer((await desktop.invoke('okedge:hardKeyHistory')) as Answer);
    } catch (e) {
      setAnswer({error: String((e as Error)?.message ?? e)});
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  /*
   * BY ITSELF (Brad, 2026-10-24: "i dont see active budget"): again when a request this app hosted is
   * over (a budget opened, an identity kept), and on a timer - every 5 s while a budget is live, so its
   * uses show as the agent spends them, every 30 s otherwise. A refresh reads the shared records only
   * (hosting.js keeps the device id), never the key.
   */
  const live = !!answer?.history?.budgets.some((b) => !b.ended);
  useEffect(() => {
    const shellOn = (globalThis as {okedge?: {on(c: string, l: () => void): () => void}}).okedge;
    const off = shellOn ? shellOn.on('okedge:hostDone', () => { setTimeout(() => void load(), 1500); }) : () => {};
    const timer = setInterval(() => void load(), live ? 5000 : 30000);
    return () => { off(); clearInterval(timer); };
  }, [load, live]);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!live) return undefined;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [live]);

  if (!desktop) return null;
  const h = answer?.history;
  return (
    <View style={styles.box}>
      <View style={styles.head}>
        <Text style={styles.title}>Budget history - this hard key</Text>
        <Btn title={busy ? 'Reading…' : 'Refresh'} onPress={() => void load()} disabled={busy} />
      </View>
      {answer?.error ? <Text style={styles.error}>{`Could not read the key: ${answer.error}`}</Text> : null}
      {answer && !answer.error && !h ? (
        <Text style={styles.dim}>{`No records for this key yet (device ${answer.deviceId?.slice(0, 16)}). A budget through onlykey-js starts its history.`}</Text>
      ) : null}
      {h ? (
        <Text style={styles.dim}>{`Device ${answer?.deviceId?.slice(0, 16)}${answer?.net === 'test' ? ' - TESTNET' : ''} · ${answer?.links} link(s) in this computer's copy`}</Text>
      ) : null}
      {/* THE LIVE ONE FIRST: uses and minutes left, before the history */}
      {h?.budgets.filter((b) => !b.ended).map((b) => {
        const usedUp = b.spends.length;
        const minsLeft = b.opened && b.lifetime ? Math.max(0, Math.ceil((b.opened + b.lifetime * 60000 - Date.now()) / 60000)) : null;
        return (
          <View key={`live-${b.grantId}`} style={[styles.card, styles.activeCard]}>
            <Text style={styles.activeTitle}>Active budget</Text>
            <Text style={styles.reason}>{b.reason ? `"${b.reason}"` : `Budget ${b.grantId}`}</Text>
            <Text style={styles.live}>
              {`${b.uses !== null ? `${Math.max(0, b.uses - usedUp)} of ${b.uses} use(s) left` : `${usedUp} used`}${minsLeft !== null ? ` · ${minsLeft} min left` : ''}`}
            </Text>
            {b.scopes.map((s, i) => <Text key={i} style={styles.scope}>{`${s.identity ?? 'slot'}: up to ${s.cap}`}</Text>)}
          </View>
        );
      })}
      {h?.budgets.map((b) => (
        <View key={b.grantId} style={styles.card}>
          <Text style={styles.reason}>{b.reason ? `"${b.reason}"` : `Budget ${b.grantId}`}</Text>
          <Text style={styles.dim}>
            {`Budget ${b.grantId} · ${b.spends.length}/${b.uses ?? '?'} used · ${b.lifetime || '?'} min · opened ${when(b.opened)}${b.from ? ` by ${b.from}` : ''}`}
          </Text>
          {b.scopes.map((s, i) => <Text key={i} style={styles.scope}>{`${s.identity ?? 'slot'}: up to ${s.cap}`}</Text>)}
          {b.spends.map((s) => (
            <Text key={s.seq} style={styles.spend}>
              {/* the receipt's words only when they say more than the intent (edge control files the intent as both) */}
              {`#${s.seq} ${s.op}${s.intent ? ` - "${s.intent}"` : ''}${s.receipt ? ` · receipt ${s.receipt.name}${s.receipt.message && s.receipt.message !== s.intent ? ` "${s.receipt.message}"` : ''}` : ' · no receipt yet'}`}
            </Text>
          ))}
          <Text style={b.ended ? styles.ended : styles.live}>{b.ended ? `Ended at #${b.ended.seq}: ${b.ended.how}` : 'Not ended'}</Text>
        </View>
      ))}
      {h?.losses.map((l) => (
        <Text key={l.seq} style={styles.loss}>{`#${l.seq} LOSS: #${l.from}-#${l.to} accepted as lost`}</Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {marginTop: 12, gap: 8},
  head: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  title: {color: theme.text, fontSize: 16, fontWeight: '700'},
  dim: {color: theme.textDim, fontSize: 13},
  error: {color: theme.error, fontSize: 13},
  card: {borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: 10, gap: 3},
  activeCard: {borderColor: theme.warn, borderWidth: 2},
  activeTitle: {color: theme.warn, fontSize: 13, fontWeight: '700', textTransform: 'uppercase'},
  reason: {color: theme.text, fontSize: 14, fontWeight: '600'},
  scope: {color: theme.textDim, fontSize: 12, fontFamily: 'monospace'},
  spend: {color: theme.text, fontSize: 12, fontFamily: 'monospace'},
  ended: {color: theme.ok ?? theme.textDim, fontSize: 12},
  live: {color: theme.warn, fontSize: 12},
  loss: {color: theme.error, fontSize: 12, fontFamily: 'monospace'},
});

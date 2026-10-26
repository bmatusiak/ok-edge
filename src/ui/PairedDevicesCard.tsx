/*
 * "PAIRED DEVICES" ON THE SYNC TAB, THE SAME ON THE PHONE AND THE DESKTOP (Brad, 2026-10-25: "this may as well indeed
 * replace the bluetooth cli pair panel, and sync will also be in phone as its own tab - so no redundant code, and the
 * app feels the same on desktop and mobile").
 *
 * The cli pair (the 6-digit flow, src/clipair in the lib) has two sides, and this card draws either one from a gate
 * (src/sync.ts pairGate):
 *   - THE PHONE answers computers. It lists the computers it answers (src/btTransit.ts: name, the code shown at
 *     pairing, last used, On/Off, Revoke), says anything the person must hear about in red (a copied pairing, one
 *     revoked for a new name or address, one expired), and "Pair a computer" opens its window (about two minutes) -
 *     the computer's code shows here, Pair, then the computer's confirm. In testing mode: Transit off, and making a
 *     renewal due.
 *   - THE COMPUTER reaches phones (electron/desktop/sync.js: ~/.onlykey-js/cli-pairing.json, the same pairs the CLI
 *     uses). It lists the phones it syncs with, and "Pair a phone" runs the pairing from the app - its code shows here
 *     to compare with the phone's, and the phone approves.
 *
 * Confirms are asked in the card, not in an Alert: an Alert draws nothing on the desktop (react-native-web), and one
 * way of asking is one feel on both.
 *
 * UI is Brad's call: screenshots before this is committed.
 */
import React, {useCallback, useEffect, useState} from 'react';
import {StyleSheet, Switch, Text, View} from 'react-native';
import {Btn, Section} from './components';
import {theme} from './theme';
import {NOTICE_TEXT, type Notice, type PairingView} from '../btTransit';
import * as clipair from 'node-onlykey-lib/clipair';

/** One paired device, as the card draws it. */
export type PairRow = {
  id: string;
  name: string;
  /* the code shown when it was paired (the phone keeps it) */
  code?: string | null;
  lastUsed?: number | null;
  renewedAt?: number | null;
  /* answered or not (the phone's per-computer switch) */
  on?: boolean;
};

/** One side of the cli pair. The optional parts are the phone's only. */
export type PairGate = {
  /* phone: it answers computers; computer: it reaches phones */
  role: 'phone' | 'computer';
  list(): Promise<PairRow[]>;
  pairing(): PairingView;
  subscribe(fn: () => void): () => void;
  openPairWindow(): void;
  closePairWindow(): void;
  /* the phone approves a pairing; a computer only shows its code */
  approvePairing?: () => void;
  revoke(id: string): Promise<unknown>;
  setOn?: (id: string, on: boolean) => Promise<unknown>;
  notices?: () => Promise<Notice[]>;
  clearNotices?: () => Promise<unknown>;
  transitOff?: () => boolean;
  setTransitOff?: (v: boolean) => Promise<unknown>;
  ageForTest?: (id: string, ms: number) => Promise<unknown>;
};

function ago(ms: number | null | undefined, now: number): string {
  if (!ms) return 'never used';
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return 'used just now';
  if (s < 3600) return `used ${Math.round(s / 60)} min ago`;
  if (s < 86400) return `used ${Math.round(s / 3600)} h ago`;
  return `used ${Math.round(s / 86400)} d ago`;
}

function subLine(r: PairRow, now: number): string {
  const parts: string[] = [];
  if (r.code) parts.push(`code ${r.code}`);
  if (r.lastUsed !== undefined) parts.push(ago(r.lastUsed, now));
  else if (r.renewedAt) parts.push(`paired ${new Date(r.renewedAt).toISOString().slice(0, 10)}`);
  if (r.on !== undefined) parts.push(r.on ? 'on' : 'off - no answer');
  return parts.join(' · ');
}

/* a span of time, in the largest whole unit */
function span(ms: number): string {
  const m = Math.max(1, Math.round(ms / 60000));
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h`;
  return `${Math.round(h / 24)} d`;
}

/*
 * WHEN THE PAIRING RENEWS, AND WHEN IT WOULD EXPIRE (Brad, 2026-10-25: "we need to see how long until it renews /
 * expires"): the cli pair's own rule (node-onlykey-lib src/clipair RENEW_AFTER, EXPIRES_AFTER) - from day 6 the next
 * use renews it; by day 7 without one it is gone, and the device must be paired again.
 */
function renewLine(r: PairRow, now: number): {text: string; warn: boolean} | null {
  if (!r.renewedAt) return null;
  const renewAt = r.renewedAt + clipair.RENEW_AFTER;
  const expireAt = r.renewedAt + clipair.EXPIRES_AFTER;
  if (now < renewAt) return {text: `renews in ${span(renewAt - now)} (on its next use after that) · expires in ${span(expireAt - now)} without one`, warn: false};
  if (now < expireAt) return {text: `renewal due - its next use renews it · expires in ${span(expireAt - now)}`, warn: true};
  return {text: 'expired - pair it again', warn: true};
}

export function PairedDevicesCard({gate, testing = false}: {gate: PairGate; testing?: boolean}) {
  const phone = gate.role === 'phone';
  const [list, setList] = useState<PairRow[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [pairing, setPairing] = useState<PairingView>({stage: 'closed'});
  const [transitOff, setTransitOff] = useState(false);
  const [now, setNow] = useState(Date.now());
  /* the row whose Revoke waits for a second tap, and the pairing waiting for its Pair */
  const [revoking, setRevoking] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);

  const refresh = useCallback(async () => {
    setList(await gate.list());
    setNotices(gate.notices ? await gate.notices() : []);
    setPairing(gate.pairing());
    setTransitOff(gate.transitOff ? gate.transitOff() : false);
  }, [gate]);

  useEffect(() => {
    void refresh();
    return gate.subscribe(() => void refresh());
  }, [gate, refresh]);

  /*
   * THE PAIRING WINDOW LIVES ONLY WHILE THIS CARD IS ON SCREEN (Brad, 2026-10-05).
   * When the card goes away - our Bluetooth switched off hides it, or another tab
   * - an open window would keep answering pairing requests with nobody looking.
   */
  useEffect(() => () => gate.closePairWindow(), [gate]);

  /* the countdown while the window is open */
  const open = pairing.stage === 'waiting' || pairing.stage === 'code' || pairing.stage === 'approved';
  useEffect(() => {
    if (!open) { setApproving(false); return; }
    const t = setInterval(() => {
      setNow(Date.now());
      setPairing(gate.pairing());
    }, 1000);
    return () => clearInterval(t);
  }, [open, gate]);

  const left = 'until' in pairing ? Math.max(0, Math.ceil((pairing.until - now) / 1000)) : 0;
  const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;

  return (
    <Section title="Paired devices">
      {transitOff ? (
        <Text style={styles.off}>Transit OFF (testing) - plaintext from any computer is answered</Text>
      ) : (
        <Text style={styles.on}>
          {phone ? 'Encrypted - only the computers below get an answer' : 'Encrypted - only the phones below are synced with'}
        </Text>
      )}

      {notices.map(n => (
        <Text key={`${n.kind}-${n.id}-${n.at}`} style={styles.alarm}>
          {NOTICE_TEXT[n.kind](n.name)}
        </Text>
      ))}
      {notices.length && gate.clearNotices ? <Btn title="Clear these" onPress={() => void gate.clearNotices?.()} /> : null}

      {list.length === 0 ? (
        <Text style={styles.note}>
          {phone
            ? 'No computer is paired. Software on a computer gets no answer until it is.'
            : 'No phone is paired. This computer syncs with none until one is.'}
        </Text>
      ) : (
        list.map(c => (
          <View key={c.id} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.name}>{c.name}</Text>
              <Text style={styles.sub}>{subLine(c, now)}</Text>
              {(() => {
                const rl = renewLine(c, now);
                return rl ? <Text style={[styles.sub, rl.warn && {color: theme.warn}]}>{rl.text}</Text> : null;
              })()}
            </View>
            {revoking === c.id ? (
              <>
                <Btn title="Keep" onPress={() => setRevoking(null)} />
                <Btn title="Revoke" tone="danger" onPress={() => { setRevoking(null); void gate.revoke(c.id); }} />
              </>
            ) : (
              <>
                {c.on !== undefined && gate.setOn ? <Switch value={c.on} onValueChange={on => void gate.setOn?.(c.id, on)} /> : null}
                <Btn title="Revoke" tone="danger" onPress={() => setRevoking(c.id)} />
              </>
            )}
          </View>
        ))
      )}
      {revoking ? (
        <Text style={styles.note}>
          {phone
            ? 'Revoke it? It gets no answer from this phone until it is paired again.'
            : 'Revoke it? This computer stops syncing with it - remove this computer on the phone too.'}
        </Text>
      ) : null}

      {/* testing mode only (T6): make the next connection renew without waiting six days */}
      {testing && gate.ageForTest
        ? list.map(c => (
            <Btn
              key={`age-${c.id}`}
              title={`Test: make ${c.name}'s renewal due`}
              onPress={() => void gate.ageForTest?.(c.id, 6 * 24 * 60 * 60 * 1000 + 60_000)}
            />
          ))
        : null}

      {pairing.stage === 'closed' || pairing.stage === 'paired' || pairing.stage === 'failed' ? (
        <>
          {/* only while that pairing still exists: a revoke or an alarm right after must not leave it saying "paired" */}
          {pairing.stage === 'paired' && list.some(c => c.name === pairing.name) ? (
            <Text style={styles.on}>{pairing.name} is paired.</Text>
          ) : null}
          {pairing.stage === 'failed' ? <Text style={styles.error}>Not paired: {pairing.reason}.</Text> : null}
          <Btn title={phone ? 'Pair a computer' : 'Pair a phone'} tone="primary" onPress={() => gate.openPairWindow()} />
        </>
      ) : (
        <View style={styles.panel}>
          {pairing.stage === 'waiting' ? (
            phone ? (
              <>
                <Text style={styles.strong}>Waiting for the computer ({clock})</Text>
                <Text style={styles.step}>1.  On the Bluetooth tab, make it the Target, with API on.</Text>
                <Text style={styles.step}>
                  2.  On it, open Sync, Pair a phone - or run <Text style={styles.mono}>onlykey-js --ble pair</Text>
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.strong}>Looking for the phone ({clock})</Text>
                <Text style={styles.step}>1.  On the phone, make this computer the Bluetooth Target, with API on.</Text>
                <Text style={styles.step}>2.  On the phone, open Sync, Pair a computer.</Text>
              </>
            )
          ) : null}
          {pairing.stage === 'code' ? (
            <>
              <Text style={styles.strong}>
                {phone ? `${pairing.name} shows a code (${clock})` : `The code (${clock})`}
              </Text>
              <Text style={styles.code}>{pairing.code}</Text>
              {phone ? (
                approving ? (
                  <>
                    <Text style={styles.note}>
                      {pairing.name} will be able to talk to the key over Bluetooth, encrypted. Every use of the key still
                      needs your approval or a press.
                    </Text>
                    <Btn title={`Pair ${pairing.name}`} tone="primary" onPress={() => { setApproving(false); gate.approvePairing?.(); }} />
                  </>
                ) : (
                  <>
                    <Text style={styles.note}>Pair only if the computer shows the same six digits.</Text>
                    <Btn title="Pair" tone="primary" onPress={() => setApproving(true)} />
                  </>
                )
              ) : (
                <Text style={styles.note}>Approve on the phone only if it shows the same six digits.</Text>
              )}
            </>
          ) : null}
          {pairing.stage === 'approved' ? (
            <Text style={styles.strong}>Waiting for {pairing.name} to confirm… ({clock})</Text>
          ) : null}
          <Btn title="Cancel" onPress={() => gate.closePairWindow()} />
        </View>
      )}

      {testing && gate.setTransitOff ? (
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={transitOff ? styles.offLabel : styles.name}>Transit off (testing only)</Text>
            <Text style={styles.sub}>Answer plaintext from the target. Never in a release build.</Text>
          </View>
          <Switch value={transitOff} onValueChange={v => void gate.setTransitOff?.(v)} />
        </View>
      ) : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  on: {color: theme.ok, fontSize: 13, marginBottom: 6},
  off: {color: theme.error, fontSize: 13, fontWeight: '600', marginBottom: 6},
  offLabel: {color: theme.error, fontSize: 14, fontWeight: '600'},
  alarm: {color: theme.error, fontSize: 13, lineHeight: 18, marginVertical: 4},
  note: {color: theme.textDim, fontSize: 12, lineHeight: 17, marginVertical: 4},
  error: {color: theme.error, fontSize: 12, lineHeight: 17, marginVertical: 4},
  row: {flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8},
  rowText: {flex: 1},
  name: {color: theme.text, fontSize: 14},
  sub: {color: theme.textDim, fontSize: 11},
  panel: {gap: 6, paddingVertical: 6},
  strong: {color: theme.text, fontSize: 14, fontWeight: '600'},
  step: {color: theme.textDim, fontSize: 14, lineHeight: 20, paddingLeft: 4},
  mono: {fontFamily: theme.mono, color: theme.textSecondary},
  code: {color: theme.text, fontSize: 36, fontFamily: theme.mono, letterSpacing: 6, textAlign: 'center', marginVertical: 8},
});

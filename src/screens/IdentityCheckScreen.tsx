/*
 * THE IDENTITY CHECK (Brad, 2026-10-24): login (versions) -> PIN -> IDENTITY CHECK -> the app.
 *
 * Right after the key unlocks, before any tab opens, this view reads WHICH identity the key is:
 * its owner key's id (the same on every device restored from one backup, lib edge identityId) and
 * this device's nametag (signed by that owner key, edgeDevices.ensureNametag). Everything the app
 * then keeps belongs to that identity.
 *
 * It is also the place to ask the person things before the app opens - pairing a remote, opening a
 * bucket the web app was handed (plan S5/S6). Nothing asked yet: it shows what it read, then Continue.
 */
import React, {useEffect, useState} from 'react';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';
import {Logo} from '../ui/Logo';
import {Btn} from '../ui/components';
import {theme} from '../ui/theme';
import {netTag} from '../net';
import {SoftKeyEdge} from '../edgeSoftKey';
import {ensureNametag} from '../edgeDevices';

type Read =
  | {kind: 'checking'}
  | {kind: 'read'; identity: string; nametag: string | null}
  | {kind: 'none'; why: string};

/*
 * WHY NOTHING WAS READ, said as it is (box, 2026-10-24: a hard key just plugged back in and unlocked did not
 * answer the first question in time, and this said "no Edge" - a key with Edge). The probe tells them apart.
 */
const whyNone = (probe: string | null): string =>
  probe === 'none' ? 'The key did not answer in time - it may still be settling after being plugged in.'
    : probe === 'no-pin' ? 'The key is locked.'
      : 'This key has no Edge: there is no identity to read.';

export function IdentityCheckScreen({keyName, onContinue}: {keyName: string; onContinue: () => void}) {
  const [read, setRead] = useState<Read>({kind: 'checking'});
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setRead({kind: 'checking'});
    void (async () => {
      const soft = await SoftKeyEdge.open().catch(() => null);
      if (!soft) {
        if (live) setRead({kind: 'none', why: whyNone(SoftKeyEdge.lastProbe)});
        return;
      }
      const identity = await soft.identityId();
      const statement = await ensureNametag(soft).catch(() => null);
      if (live) setRead({kind: 'read', identity, nametag: statement?.nametag ?? null});
    })().catch((e: unknown) => {
      if (live) setRead({kind: 'none', why: `Could not read the identity: ${String((e as Error)?.message ?? e)}`});
    });
    return () => { live = false; };
  }, [attempt]);

  return (
    <View style={styles.root}>
      <Logo height={44} />
      <Text style={styles.title}>{read.kind === 'checking' ? 'Checking this key\'s identity…' : 'This key'}</Text>
      <View style={styles.card}>
        <Row label="key" value={keyName} />
        <Row label="chain" value={netTag() ? 'testnet' : 'live'} />
        {read.kind === 'read' ? (
          <>
            <Row label="identity" value={`${read.identity.slice(0, 12)}…`} />
            <Row label="this device" value={read.nametag ? `"${read.nametag}"` : 'no nametag yet'} />
          </>
        ) : null}
        {read.kind === 'checking' ? <ActivityIndicator style={styles.spinner} color={theme.textDim} /> : null}
      </View>
      {read.kind === 'none' ? <Text style={styles.hint}>{read.why}</Text> : null}
      {read.kind === 'read' ? (
        <Text style={styles.hint}>Everything this app keeps for this key belongs to this identity - every device restored from the same backup shares it.</Text>
      ) : null}
      <View style={styles.action}>
        {read.kind === 'none' ? <Btn title="Try again" onPress={() => setAttempt(n => n + 1)} /> : null}
        <Btn title="Continue" tone="primary" onPress={onContinue} disabled={read.kind === 'checking'} />
      </View>
    </View>
  );
}

function Row({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24},
  title: {marginTop: 28, color: theme.text, fontSize: 16, fontWeight: '600'},
  card: {
    marginTop: 16,
    width: '100%',
    maxWidth: 320,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  row: {flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6},
  rowLabel: {color: theme.textDim, fontSize: 12},
  rowValue: {color: theme.textSecondary, fontSize: 12, fontFamily: theme.mono, flexShrink: 1},
  spinner: {paddingVertical: 8},
  hint: {marginTop: 14, maxWidth: 320, color: theme.textDim, fontSize: 12, textAlign: 'center', lineHeight: 17},
  action: {marginTop: 28, width: '100%', maxWidth: 320, gap: 12},
});

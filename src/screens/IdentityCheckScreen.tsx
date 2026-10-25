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
import {SkipPressHint} from '../ui/SkipPressHint';
import {theme} from '../ui/theme';
import {netTag} from '../net';
import {SoftKeyEdge} from '../edgeSoftKey';
import {ensureNametag} from '../edgeDevices';
import {bucketState, openIdentityBucket, openLegacyStorage} from '../bucketStore';
import {getOnlyKey} from '../onlykey';
import {activeBackend} from '../hooks/KeyContext';

type Read =
  | {kind: 'checking'}
  | {kind: 'read'; identity: string; nametag: string | null; bucket: 'kept' | 'sealed' | 'none'}
  | {kind: 'none'; why: string};

/*
 * WHY NOTHING WAS READ, said as it is (box, 2026-10-24: a hard key just plugged back in and unlocked did not
 * answer the first question in time, and this said "no Edge" - a key with Edge). The probe tells them apart.
 */
const whyNone = (probe: string | null): string =>
  probe === 'none' ? 'The key did not answer in time - it may still be settling after being plugged in.'
    : probe === 'no-pin' ? 'The key is locked.'
      : 'This key has no Edge: there is no identity to read.';

/* opening the bucket after Continue: asking the key, waiting for its press, or what went wrong */
type Open = {kind: 'idle'} | {kind: 'opening'} | {kind: 'press'} | {kind: 'failed'; why: string};

export function IdentityCheckScreen({keyName, onContinue, onPress}: {keyName: string; onContinue: () => void; onPress?: () => void}) {
  const [read, setRead] = useState<Read>({kind: 'checking'});
  const [open, setOpen] = useState<Open>({kind: 'idle'});

  /*
   * THE BUTTON OPENS THIS IDENTITY'S BUCKET (Brad, 2026-10-24: "a button press here is needed to decrypt the
   * container"): the key decapsulates it and asks for its press; then the app opens. A key with no identity
   * to read (no Edge) has no bucket here, and goes on.
   */
  const continueAndOpen = async () => {
    if (read.kind !== 'read') { openLegacyStorage(); onContinue(); return; }
    setOpen({kind: 'opening'});
    try {
      const {okcrypto} = await getOnlyKey(activeBackend());
      await openIdentityBucket(read.identity, okcrypto, () => setOpen({kind: 'press'}));
      onContinue();
    } catch (e: unknown) {
      setOpen({kind: 'failed', why: String((e as Error)?.message ?? e)});
    }
  };
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setRead({kind: 'checking'});
    void (async () => {
      /*
       * A KEY JUST UNLOCKED IS STILL SETTLING (box, 2026-10-24): the hard key re-connects right after its unlock
       * (useHardKey), and a question asked in that moment timed out - asked again a moment later, it answered.
       * So "no answer in time" is asked twice more, 1.5 s apart, before it is said.
       */
      let soft = await SoftKeyEdge.open().catch(() => null);
      for (let n = 0; !soft && live && SoftKeyEdge.lastProbe === 'none' && n < 2; n++) {
        await new Promise(r => setTimeout(r, 1500));
        soft = await SoftKeyEdge.open().catch(() => null);
      }
      if (!live) return;
      if (!soft) {
        if (live) setRead({kind: 'none', why: whyNone(SoftKeyEdge.lastProbe)});
        return;
      }
      const identity = await soft.identityId();
      const statement = await ensureNametag(soft).catch(() => null);
      /* asked here so the button says what it will do; unknown is treated as the press it may need */
      const bucket = await bucketState(identity).catch(() => 'sealed' as const);
      if (live) setRead({kind: 'read', identity, nametag: statement?.nametag ?? null, bucket});
    })().catch((e: unknown) => {
      if (live) setRead({kind: 'none', why: `Could not read the identity: ${String((e as Error)?.message ?? e)}`});
    });
    return () => { live = false; };
  }, [attempt]);

  /*
   * NOTHING TO ASK, NOTHING TO STOP FOR (Brad, 2026-10-25: "the continue button can now be skipped after identity
   * check is successful AND we already decrypted our bucket before"): the identity was read and this computer
   * already keeps its bucket opened (the desktop after its first open) - the app opens by itself. Once per read.
   */
  useEffect(() => {
    if (read.kind === 'read' && read.bucket === 'kept') void continueAndOpen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [read]);

  /*
   * THE BUTTON SAYS WHAT IT DOES (Brad, 2026-10-25: Continue "should turn into Decrypt Bucket"): a sealed bucket is
   * decrypted by the key (a press); an identity seen for the first time gets a new bucket (no key needed); a key
   * with no identity has no bucket and just goes on.
   */
  const action = read.kind !== 'read' ? 'Continue' : read.bucket === 'none' ? 'Create Bucket' : 'Decrypt Bucket';

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
        {open.kind === 'opening' ? <Text style={styles.hint}>Opening this identity's bucket…</Text> : null}
        {open.kind === 'press' ? <Text style={[styles.hint, styles.press]}>Press the key to open this identity's bucket</Text> : null}
        {open.kind === 'press' && onPress ? <Btn title="Press the soft key" tone="primary" onPress={onPress} /> : null}
        {/* the bucket opens by a decapsulation on slot 128: field 30 decides its press */}
        {open.kind === 'press' ? <SkipPressHint /> : null}
        {open.kind === 'failed' ? <Text style={[styles.hint, {color: theme.error}]}>{`The bucket did not open: ${open.why}`}</Text> : null}
        {read.kind === 'none' ? <Btn title="Try again" onPress={() => setAttempt(n => n + 1)} /> : null}
        <Btn
          title={open.kind === 'failed' ? 'Try again' : action}
          tone="primary"
          onPress={() => void continueAndOpen()}
          disabled={read.kind === 'checking' || open.kind === 'opening' || open.kind === 'press'}
        />
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
  press: {color: theme.warn, fontSize: 14, fontWeight: '600'},
  hint: {marginTop: 14, maxWidth: 320, color: theme.textDim, fontSize: 12, textAlign: 'center', lineHeight: 17},
  action: {marginTop: 28, width: '100%', maxWidth: 320, gap: 12},
});

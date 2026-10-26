/*
 * THE IDENTITY CHECK (Brad, 2026-10-24): login (versions) -> PIN -> IDENTITY CHECK -> the app.
 *
 * Right after the key unlocks, before any tab opens, this view reads WHICH identity the key is: its BUCKET
 * IDENTITY - the key's agent key of the empty label "" (lib bucket-identity; Brad, 2026-10-25: "\"\" is the identity
 * of the key, not tied to edge"), the same on every device restored from one backup, on any OnlyKey since 2.1.0.
 * Everything the app then keeps belongs to it. A key with Edge also shows this device's nametag - Edge's own
 * statement (edgeDevices.ensureNametag), signed by Edge's owner key, a different thing.
 *
 * It is also the place to ask the person things before the app opens - pairing a remote, opening a
 * bucket the web app was handed (plan S5/S6). Nothing asked yet: it shows what it read, then Continue.
 */
import React, {useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Logo} from '../ui/Logo';
import {Btn} from '../ui/components';
import {SkipPressHint} from '../ui/SkipPressHint';
import {theme} from '../ui/theme';
import {netTag} from '../net';
import {openIdentityBucket, openLegacyStorage} from '../bucketStore';
import {readKeyIdentity} from '../keyIdentity';
import {IdentityCard} from '../ui/IdentityCard';
import {getOnlyKey} from '../onlykey';
import {activeBackend} from '../hooks/KeyContext';

type Read =
  | {kind: 'checking'}
  | {kind: 'read'; identity: string; edgeIdentity: string | null; nametag: string | null; bucket: 'kept' | 'sealed' | 'none'}
  | {kind: 'none'; why: string};


/* opening the bucket after Continue: asking the key, waiting for its press, or what went wrong */
type Open = {kind: 'idle'} | {kind: 'opening'} | {kind: 'press'} | {kind: 'failed'; why: string};

export function IdentityCheckScreen({keyName, onContinue, onPress}: {keyName: string; onContinue: () => void; onPress?: () => void}) {
  const [read, setRead] = useState<Read>({kind: 'checking'});
  const [open, setOpen] = useState<Open>({kind: 'idle'});

  /*
   * THE BUTTON OPENS THIS IDENTITY'S BUCKET (Brad, 2026-10-24: "a button press here is needed to decrypt the
   * container"): the key decapsulates it and asks for its press; then the app opens. A key whose bucket identity
   * could not be read (firmware with no agent derive) has no bucket here, and goes on with plain storage.
   */
  const continueAndOpen = async () => {
    if (read.kind !== 'read') { openLegacyStorage(); onContinue(); return; }
    setOpen({kind: 'opening'});
    try {
      const {okcrypto} = await getOnlyKey(activeBackend());
      await openIdentityBucket(read.identity, okcrypto, () => setOpen({kind: 'press'}), read.edgeIdentity);
      onContinue();
    } catch (e: unknown) {
      setOpen({kind: 'failed', why: String((e as Error)?.message ?? e)});
    }
  };
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setRead({kind: 'checking'});
    /* the read is src/keyIdentity.ts's, and kept there - This Key's Identity panel shows the same result */
    void readKeyIdentity(() => live).then(r => { if (live && r) setRead(r); });
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
      <IdentityCard
        checking={read.kind === 'checking'}
        rows={[
          {label: 'key', value: keyName},
          {label: 'chain', value: netTag() ? 'testnet' : 'live'},
          ...(read.kind === 'read' ? [{label: 'bucket identity', value: `${read.identity.slice(0, 12)}…`}] : []),
          ...(read.kind === 'read' && read.edgeIdentity ? [{label: 'this device', value: read.nametag ? `"${read.nametag}"` : 'no nametag yet'}] : []),
        ]}
      />
      {read.kind === 'none' ? <Text style={styles.hint}>{read.why}</Text> : null}
      {read.kind === 'read' ? (
        <Text style={styles.hint}>Everything this app keeps for this key belongs to this bucket identity - every device restored from the same backup shares it.</Text>
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

const styles = StyleSheet.create({
  root: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24},
  title: {marginTop: 28, color: theme.text, fontSize: 16, fontWeight: '600'},
  press: {color: theme.warn, fontSize: 14, fontWeight: '600'},
  hint: {marginTop: 14, maxWidth: 320, color: theme.textDim, fontSize: 12, textAlign: 'center', lineHeight: 17},
  action: {marginTop: 28, width: '100%', maxWidth: 320, gap: 12},
});

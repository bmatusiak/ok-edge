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
import {bucketLabelOf, openIdentityBucket, openLegacyStorage} from '../bucketStore';
import {proofKept, proofMaterial} from '../bucketTrade';
import {shell} from '../platform';
import {readKeyIdentity} from '../keyIdentity';
import {IdentityCard} from '../ui/IdentityCard';
import {getOnlyKey} from '../onlykey';
import {activeBackend} from '../hooks/KeyContext';
import {Linking} from 'react-native';

/*
 * THE KEY NAMES ANOTHER SITE (Brad, 2026-10-29: "if i go to apps.crp.to, it reads my key and sees i use a private mcp, it
 * should tell the user and give a link for the user to redirect - never on its own redirect"; "if the key's rpid that is
 * set does not match, it shows re-direct"). The key's Edge and its bucket are derived under its own site (no fallback):
 * this page, on another one, derives other keys and reaches none of them. Said, with the key's site as a link the person
 * follows - the page never moves by itself.
 */
function wrongSite(site: string | null): string | null {
  if (shell !== 'webapp' || !site || typeof location === 'undefined') return null;
  return location.hostname === site ? null : site;
}

type Read =
  | {kind: 'checking'}
  | {kind: 'read'; identity: string; edgeIdentity: string | null; nametag: string | null; bucket: 'kept' | 'sealed' | 'none'; site: string | null}
  | {kind: 'none'; why: string};


/* opening the bucket after Continue: asking the key, waiting for its press, or what went wrong */
type Open = {kind: 'idle'} | {kind: 'opening'} | {kind: 'press'} | {kind: 'failed'; why: string};

/*
 * WHAT A LOGIN'S BUDGET IS NAMED (Brad, 2026-10-29: the site, the app, the device, the time - no IP): its reason, the words
 * kept with its opening and listed in every device's budget history. The site is the page's own (a browser binds the
 * key's answers to it); the app and the browser are what this app says of itself; the time is the opening's.
 */
declare const location: {host: string; hostname: string} | undefined;
declare const navigator: {userAgent?: string} | undefined;
function loginReason(): string {
  if (shell === 'webapp') {
    const ua = String(navigator?.userAgent ?? '');
    const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'a browser';
    return `log in: the web app in ${browser} at ${typeof location !== 'undefined' ? location.host : 'its site'}`;
  }
  return `log in: the ${shell === 'desktop' ? 'desktop' : 'phone'} app`;
}

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
      const {okcrypto, identity} = await getOnlyKey(activeBackend());
      const open = () => openIdentityBucket(read.identity, okcrypto, () => setOpen({kind: 'press'}), read.edgeIdentity);
      if (read.bucket === 'kept' || typeof (identity as any)?.login !== 'function') {
        /* the desktop's shared file: opened with no press - nothing for a login budget to pay */
        await open();
      } else {
        /*
         * THE LOGIN PLAN (lib identity.login; PROPOSAL-login-plan.md; Brad, 2026-10-29: "1 press = logs into our app";
         * "this gives me a log in log in the edge blockchain"): the bucket's derive, the identity proof on a first login
         * here, this device's bucket key certificate while none is kept - in ONE Edge budget, one press, each a link with
         * its receipt, named for the app and the site. The bucket key itself is the key's shared secret, which no budget
         * pays: on a first login here it still asks its code. A key without the login budget logs in as before.
         */
        const keyKept = await proofKept(read.identity);
        const signs = (read.bucket === 'none' ? 1 : 0) + (keyKept ? 0 : 1);
        await (identity as any).login(async () => {
          await open();
          if (!keyKept) await proofMaterial();
        }, {reason: loginReason(), derives: [bucketLabelOf(read.identity)], signs, onPress: () => setOpen({kind: 'press'})});
      }
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
      {read.kind === 'read' && wrongSite(read.site) ? (
        <View style={styles.elsewhere}>
          <Text style={[styles.hint, styles.press]}>{`This key belongs to ${read.site} - not this page (${location!.hostname}).`}</Text>
          <Text style={styles.hint}>Its Edge history and its bucket are bound to that site: here they cannot open, and nothing this page makes reaches them.</Text>
          <Btn title={`Go to ${read.site}`} tone="primary" onPress={() => { void Linking.openURL(`https://${read.site}/`); }} />
        </View>
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
          /* on a page that is not the key's own site, the way to the key's site is the main action (apps.crp.to as the shorthand for a private MCP) */
          tone={read.kind === 'read' && wrongSite(read.site) ? undefined : 'primary'}
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
  elsewhere: {marginTop: 8, width: '100%', maxWidth: 320, gap: 8, alignItems: 'center'},
});

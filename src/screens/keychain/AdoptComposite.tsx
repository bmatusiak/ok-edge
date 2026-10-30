import React, {useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {ListPicker, type PickItem} from '../../ui/ListPicker';
import {theme} from '../../ui/theme';
import {openpgpFork} from '../../pgpOps';
import {pluginRecipientSources} from '../../plugins/registry';
import {updateKeyChainList} from '../../keyChainRecorder';

const keychain = require('node-onlykey-lib/keychain');

declare const crypto: {getRandomValues<T extends Uint8Array>(array: T): T};
const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));

/*
 * ADOPT A COMPOSITE KEY ALREADY ON THE ONLYKEY (Brad, 2026-10-26: "they may want to adopt or create a new one, there
 * choice"). A composite slot with no certificate in Key Chain - loaded by another tool, made on another device - is
 * offered beside the wizard's "make a new one"; the user decides. The certificates to pick from are the ones this app
 * already holds: people's composite PGP keys from the recipient sources (Guest Book, through the core's plugin seam -
 * Key Chain never imports a plugin), and Key Chain's own composite entries that are not in this slot now (a key that
 * moved, or one marked gone). The pick is proven by the slot itself, one press (keychain composite.adopt): a
 * certificate the slot cannot sign for is refused and nothing is listed.
 */
type Candidate = {key: string; title: string; detail: string; pgp: string};

async function candidatesFor(slot: number, entries: any[]): Promise<Candidate[]> {
  const openpgp = openpgpFork();
  const raw: {title: string; detail: string; pgp: string}[] = [];
  for (const e of entries) {
    if (e.type !== 'composite' || !e.pgp) continue;
    if ((e.slots || []).includes(slot) && keychain.list.present(e)) continue;
    raw.push({title: e.name || 'composite key', detail: `Key Chain - was in ${(e.slots || []).map((n: number) => `RSA${n}`).join(', ') || 'a slot'}`, pgp: e.pgp});
  }
  for (const source of pluginRecipientSources()) {
    const people = [...(await source.pgpContacts().catch(() => [])), ...[await source.me().catch(() => null)].filter(Boolean)] as any[];
    for (const person of people) {
      for (const k of person.keys || []) if (k.composite) raw.push({title: `${person.name}: ${k.label}`, detail: `${source.name}${k.verified ? ' - verified' : ' - not verified'}`, pgp: k.text});
    }
  }
  const out: Candidate[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    const cert = await keychain.composite.certificate(openpgp, r.pgp).catch(() => null);
    if (!cert || seen.has(cert.pgpFingerprint)) continue;
    seen.add(cert.pgpFingerprint);
    out.push({key: cert.pgpFingerprint, title: r.title, detail: `${r.detail} - ${cert.pgpFingerprint.slice(0, 16)}`, pgp: r.pgp});
  }
  return out;
}

export function AdoptComposite({slot, entries, getKey, busy, onBusy, onStatus, onError}: {
  slot: number;
  entries: any[];
  getKey: () => Promise<any>;
  busy: boolean;
  onBusy: (b: boolean) => void;
  onStatus: (s: string | null) => void;
  onError: (e: string | null) => void;
}) {
  const [items, setItems] = useState<Candidate[] | null>(null);
  useEffect(() => {
    let alive = true;
    void candidatesFor(slot, entries).then(c => { if (alive) setItems(c); }, () => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, [slot, entries]);

  const adopt = async (fingerprint: string) => {
    const c = items?.find(i => i.key === fingerprint);
    if (!c) return;
    onBusy(true);
    onError(null);
    onStatus(`Proving RSA${slot} holds ${c.title}: press when the key asks.`);
    try {
      const {okcrypto} = await getKey();
      const made = await keychain.composite.adopt(okcrypto, openpgpFork(), {slot, pgp: c.pgp, randomBytes});
      await updateKeyChainList(list => keychain.list.merge(list, [made]).entries);
      onStatus(`RSA${slot} proved it holds ${c.title}: it is in Key Chain now, for signing and opening messages.`);
    } catch (e) {
      onStatus(null);
      onError(String((e as Error)?.message ?? e));
    } finally {
      onBusy(false);
    }
  };

  return (
    <View style={styles.box}>
      <Text style={styles.note}>
        Key Chain has no certificate for this composite key. Adopt one you already have - the key proves it with one press - or
        make a new key with the Wizard.
      </Text>
      {items === null ? (
        <Text style={styles.note}>Looking for certificates…</Text>
      ) : items.length ? (
        <ListPicker
          label="Adopt"
          placeholder="Pick its certificate…"
          sheetTitle={`The certificate of RSA${slot}`}
          items={items.map((i): PickItem => ({key: i.key, title: i.title, detail: i.detail, disabled: busy}))}
          selected={[]}
          onChange={keys => { if (keys[0]) void adopt(keys[0]); }}
        />
      ) : (
        <Text style={styles.note}>No composite certificate in Key Chain or Guest Book. Add the key's public certificate to Guest Book to adopt it.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {marginTop: 6, marginBottom: 6},
  note: {color: theme.textDim, fontSize: 12, lineHeight: 18, marginBottom: 6},
});

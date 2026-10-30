/*
 * THIS PHONE AND YOUR DEVICES, in the Edge Management drawer (Brad, 2026-10-08: the nametag
 * is set "in the Edge Management drawer"; a device gives "its own name for its device
 * fingerprint in the block"; "find a way to fix multi names for the same device").
 *
 * This device: its nametag, certified by its key at a press (a link on the chain) and kept in the
 * identity bucket, which carries it to your other devices. Your devices: one row per key whose
 * signed nametag the bucket holds - every name it signed, newest first, its fingerprint, how far
 * its log is merged here. Nothing to remove: the list is what Edge holds (Brad, 2026-10-30).
 */
import React, {useCallback, useEffect, useState} from 'react';
import {KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, View} from 'react-native';
import {grants} from 'node-onlykey-lib/edge';
import {currentDeviceId, deviceName, ownNames, nametagOr, onDevicesChanged, ownStatement, setNametag, type StoredStatement} from '../edgeDevices';
import {SoftKeyEdge} from '../edgeSoftKey';
import {useYourDevices} from '../hooks/useYourDevices';
import {Btn, Section} from './components';
import {theme} from './theme';
import {DEVICE_WORD} from '../platform';

const short = (id: string) => `${id.slice(0, 8)}…${id.slice(-8)}`;

export function YourDevicesCard({headSeq}: {headSeq: number | null | undefined}) {
  const [own, setOwn] = useState<StoredStatement | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const devices = useYourDevices(headSeq);
  const [devName, setDevName] = useState('');
  const [names, setNames] = useState<string[]>([]);
  /* this device's key, named or not (Brad, 2026-10-30: "This computer needs to display its device key") */
  const [devId, setDevId] = useState<string | null>(null);
  /* the probed device name is only offered in the dialog: the person keeps it or types their own (Brad, 2026-10-30) */
  const load = useCallback(async () => {
    /* opened first: it names the key in use (its device id); nothing is signed here */
    await SoftKeyEdge.open().catch(() => null);
    setOwn(await ownStatement());
    setDevName(await deviceName());
    setNames(await ownNames());
    setDevId(currentDeviceId());
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => onDevicesChanged(() => { void load(); }), [load]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      grants.nametagHash(draft); /* the same rule the key signs under: 1 to 64 characters */
      const soft = await SoftKeyEdge.open();
      if (!soft) throw new Error('the key did not answer - is it unlocked?');
      setOwn(await setNametag(soft, draft.trim()));
      setEditing(false);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Section title={`This ${DEVICE_WORD}`}>
        <Text style={styles.op}>{nametagOr(own?.nametag)}</Text>
        {names.length > 1 ? <Text style={styles.dim}>{`Earlier: ${names.slice(1).join(', ')}`}</Text> : null}
        {devId ? <Text style={styles.dim}>{`Device ${short(devId)}`}</Text> : null}
        <Text style={styles.dim}>{`Your other devices see this ${DEVICE_WORD} by its nametag. The key certifies it: press the key when it asks.`}</Text>
        {error ? <Text style={[styles.op, {color: theme.error}]}>{error}</Text> : null}
        <View style={styles.row}>
          <Btn title={own ? 'Change nametag…' : 'Set nametag…'} onPress={() => { setDraft(own?.nametag ?? devName); setEditing(true); }} disabled={busy} />
        </View>
      </Section>
      <Section title={`Your devices${devices.length ? ` (${devices.length})` : ''}`}>
        {!devices.length ? <Text style={styles.dim}>None yet. Each key of yours shows here once its nametag is signed - sync brings them from your other devices.</Text> : null}
        {devices.map(d => (
          <View key={d.deviceId} style={styles.item}>
            <Text style={styles.op}>{nametagOr(d.nametag)}</Text>
            {d.names.length > 1 ? <Text style={styles.dim}>{`Earlier: ${d.names.slice(1).join(', ')}`}</Text> : null}
            <Text style={styles.dim}>{`Device ${short(d.deviceId)}${d.mergedUpTo !== null ? ` · merged up to #${d.mergedUpTo}` : ''}${d.mergedAt ? ` · ${new Date(d.mergedAt).toLocaleString()}` : ''}`}</Text>
          </View>
        ))}
      </Section>
      {/* its own small dialog, above the keyboard (the drawer scrolled away from an inline field - Pixel, 2026-10-05) */}
      <Modal transparent animationType="fade" visible={editing} onRequestClose={() => setEditing(false)}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.dialog}>
            <Text style={styles.op}>{`This ${DEVICE_WORD}'s nametag`}</Text>
            <Text style={styles.dim}>{`A name or a tag your other devices will see for this ${DEVICE_WORD}.`}</Text>
            {/* the offer: what this device calls itself, filled in - Save keeps it, or type your own */}
            {!own && devName ? <Text style={styles.dim}>{`This ${DEVICE_WORD} calls itself "${devName}" - keep it or type your own.`}</Text> : null}
            <TextInput style={styles.input} value={draft} onChangeText={setDraft} placeholder={devName || 'a name or a tag'} placeholderTextColor={theme.textDim} maxLength={64} autoFocus />
            {error ? <Text style={[styles.op, {color: theme.error}]}>{error}</Text> : null}
            <View style={styles.row}>
              <Btn title="Save" tone="primary" disabled={!draft.trim() || busy} onPress={() => { void save(); }} />
              <Btn title="Cancel" onPress={() => setEditing(false)} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  op: {color: theme.text, fontSize: 14, lineHeight: 20},
  dim: {color: theme.textDim, fontSize: 13, lineHeight: 19},
  row: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6},
  backdrop: {flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 16},
  dialog: {backgroundColor: theme.surface, borderRadius: 12, padding: 16},
  input: {color: theme.text, borderWidth: 1, borderColor: theme.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginTop: 6, fontSize: 15},
  item: {marginTop: 10, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border},
});

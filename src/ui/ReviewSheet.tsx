/*
 * NEW IN YOUR LOG (Brad, 2026-10-24: "i should not be asked to merge anything.. i should just
 * open a log and see everything"; "a way to NOTICE and REVIEW what gets merged ... approve what
 * i see, as in, i confirmed i seen it").
 *
 * Opened from the Edge tab's banner. What other devices of your key brought - already merged
 * into your log the moment its signatures checked (edgeDevices.receiveLog) - one row per
 * device, a warning first. "Seen" is your word that you looked; it holds nothing back.
 * Nothing here needs the key's press.
 */
import React, {useCallback, useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {loadNew, markSeen, onDevicesChanged, type NewItem} from '../edgeDevices';
import {consentRefusal} from '../debugGuard';
import {netTag} from '../net';
import {Btn} from './components';
import {Sheet} from './Sheet';
import {theme} from './theme';

const short = (id: string) => `${id.slice(0, 8)}…${id.slice(-8)}`;

export function ReviewSheet({visible, onClose}: {visible: boolean; onClose: () => void}) {
  const [rows, setRows] = useState<NewItem[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const load = useCallback(async () => { setRows(await loadNew()); }, []);
  useEffect(() => { if (visible) { setNote(null); void load(); } }, [visible, load]);
  useEffect(() => onDevicesChanged(() => { void load(); }), [load]);

  /* "Seen" while a computer could tap for you (debugging lock off) is refused: a warning is cleared only by you */
  const seen = (deviceId?: string) => async () => {
    const refused = consentRefusal();
    if (refused) { setNote(refused); return; }
    await markSeen(deviceId);
    void load();
  };

  return (
    <Sheet visible={visible} tone="edge" title={netTag() + 'New in your log'} titleColor={theme.text} onClose={onClose}
      footer={<Btn title={rows.length > 1 ? 'Seen all' : 'Close'} onPress={rows.length > 1 ? seen() : onClose} />}>
      <Text style={styles.dim}>Uses of your key from your other devices, already in your log. Look them over: anything you did not do is someone else using your key.</Text>
      {rows.map(r => (
        <View key={r.deviceId} style={styles.item}>
          <Text style={styles.op}>{`"${r.nametag}"${r.newDevice ? ' - a new device of your key' : ''}`}</Text>
          <Text style={styles.dim}>{`${r.links} new link${r.links === 1 ? '' : 's'} · brought by ${r.from} · ${new Date(r.at).toLocaleString()} · device ${short(r.deviceId)}`}</Text>
          {r.warning ? <Text style={[styles.op, {color: theme.error}]}>{`This log ${r.warning}.`}</Text> : null}
          {r.missing.length ? (
            <Text style={[styles.dim, {color: theme.warn}]}>{`${r.missing.length} use(s) arrived without their words: ${r.missing.slice(0, 3).join('; ')}${r.missing.length > 3 ? ' …' : ''}`}</Text>
          ) : null}
          <View style={styles.row}><Btn title="Seen" tone="primary" onPress={seen(r.deviceId)} /></View>
        </View>
      ))}
      {!rows.length ? <Text style={[styles.op, {marginTop: 12}]}>Nothing new. Everything your devices brought is in your log.</Text> : null}
      {note ? <Text style={[styles.op, {marginTop: 10}]}>{note}</Text> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  op: {color: theme.text, fontSize: 14, lineHeight: 20},
  dim: {color: theme.textDim, fontSize: 13, lineHeight: 19},
  row: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6},
  item: {marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border},
});

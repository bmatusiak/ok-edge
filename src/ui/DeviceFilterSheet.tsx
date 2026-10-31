/*
 * WHICH DEVICES THE EDGE TAB SHOWS (Brad, 2026-10-31: "it should be a filter toggle selection screen"; "by default show
 * all in filter") - it replaced the "New in your log" sheet, whose Seen buttons asked you to approve other devices into
 * your history ("it should not be asking me to approve them into blockchain"). One row per device in the history - its
 * nametag (or UNNAMED) and its short device id - and a toggle. A log whose chain does not check is listed below, for
 * what it is: not in your history, nothing to approve.
 */
import React, {useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {loadNew, onDevicesChanged, type ForkTree, type NewItem} from '../edgeDevices';
import {onFilter, setShown, showAll, shown} from '../edgeFilter';
import {netTag} from '../net';
import {Btn} from './components';
import {Sheet} from './Sheet';
import {theme} from './theme';

export type FilterDevice = {deviceId: string; name: string; thisDevice?: boolean};
const short = (id: string) => `${id.slice(0, 8)}…`;

/*
 * EACH DEVICE'S PLACE IN THE TREE (Brad, 2026-10-31: "when i restore a backup, it should be depicted as a fork"; "a fork
 * on the same backup is a yellow flag"): the original chain, or a fork of its parent at the seq it continued from - and
 * the flag when another key continued the same backup point.
 */
function originLine(id: string, forks: ForkTree | null, nameOf: (id: string) => string): {text: string; flag: boolean} | null {
  const c = forks?.chains.find(x => x.deviceId === id);
  if (!c) return null;
  if (c.start === 'original') return {text: 'the original chain', flag: false};
  if (c.start === 'partial') return {text: 'held here from a later link - where it began is not known here', flag: false};
  const p = forks!.points.find(x => x.point === c.point);
  const others = (p?.forks ?? []).filter(f => f !== id);
  const from = c.parent ? `a restore of ${nameOf(c.parent)}'s backup` : 'a restore of a backup';
  if (others.length) return {text: `${from}, forked at #${c.forkSeq} - the same backup as ${others.map(nameOf).join(', ')}: was each restore yours?`, flag: true};
  return {text: `${from}, forked at #${c.forkSeq}`, flag: false};
}

export function DeviceFilterSheet({visible, onClose, devices, forks = null}: {visible: boolean; onClose: () => void; devices: FilterDevice[]; forks?: ForkTree | null}) {
  const nameOf = (id: string) => devices.find(d => d.deviceId === id)?.name ?? `device ${short(id)}`;
  const [, setTick] = useState(0);
  const [failing, setFailing] = useState<NewItem[]>([]);
  useEffect(() => onFilter(() => setTick(t => t + 1)), []);
  useEffect(() => {
    const load = () => { void loadNew().then(setFailing).catch(() => setFailing([])); };
    if (visible) load();
    return onDevicesChanged(load);
  }, [visible]);

  return (
    <Sheet visible={visible} tone="edge" title={netTag() + 'Devices in your history'} titleColor={theme.text} onClose={onClose}
      footer={<View style={styles.row}><Btn title="Show all" onPress={showAll} /><Btn title="Close" tone="primary" onPress={onClose} /></View>}>
      <Text style={styles.dim}>Every use of your key from every device is in your log. Switch a device off to hide its budgets and presses here; switch it on to see them again.</Text>
      {devices.map(d => {
        const on = shown(d.deviceId);
        const origin = originLine(d.deviceId, forks, nameOf);
        return (
          <View key={d.deviceId} style={styles.item}>
            <View style={styles.text}>
              <Text style={styles.op}>{d.name}{d.thisDevice ? ' (this key)' : ''}</Text>
              <Text style={styles.dim}>{`device ${short(d.deviceId)}`}</Text>
              {origin ? <Text style={[styles.dim, origin.flag ? {color: theme.warn} : null]}>{`${origin.flag ? '⚠ ' : ''}${origin.text}`}</Text> : null}
            </View>
            <Btn title={on ? 'On' : 'Off'} tone={on ? 'primary' : undefined} onPress={() => setShown(d.deviceId, !on)} label={`${on ? "Hide" : "Show"} ${d.name}`} />
          </View>
        );
      })}
      {failing.map(f => (
        <View key={`x${f.deviceId}`} style={styles.item}>
          <View style={styles.text}>
            <Text style={styles.op}>{`"${f.nametag}"`}</Text>
            <Text style={styles.dim}>{`device ${short(f.deviceId)} · brought by ${f.from}`}</Text>
            <Text style={[styles.dim, {color: theme.error}]}>{`Its log ${f.warning ?? 'does not check'} - not in your history.`}</Text>
          </View>
        </View>
      ))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  op: {color: theme.text, fontSize: 14, lineHeight: 20},
  dim: {color: theme.textDim, fontSize: 13, lineHeight: 19},
  row: {flexDirection: 'row', gap: 10, justifyContent: 'flex-end'},
  item: {flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border},
  text: {flex: 1},
});

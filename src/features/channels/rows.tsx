/* THE ACTIVITY CARDS' ROWS (each channel's card, src/features/channels): a label, its value, "how long ago" */
import React, {useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {theme} from '../../ui/theme';
import {ioLast, onIo, type IoChannel} from '../../btActivity';

export const ago = (at: number | undefined | null, now: number): string => {
  if (!at) return 'none since the app started';
  const s = Math.max(0, Math.round((now - at) / 1000));
  return s < 60 ? `${s} s ago` : s < 3600 ? `${Math.round(s / 60)} min ago` : new Date(at).toLocaleTimeString();
};
export const lastOf = (c: IoChannel, now: number): string => {
  const l = ioLast(c);
  return l ? `${ago(l.at, now)} (${l.count} since the app started)` : 'none since the app started';
};
export function Row({label, value}: {label: string; value: React.ReactNode}) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      {typeof value === 'string' ? <Text style={rowStyles.value}>{value}</Text> : value}
    </View>
  );
}
export const rowStyles = StyleSheet.create({
  row: {flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 3},
  label: {color: theme.textDim, fontSize: 13},
  value: {color: theme.text, fontSize: 13, flexShrink: 1, textAlign: 'right'},
  buttons: {flexDirection: 'row', gap: 8, marginTop: 6},
});

/* the cards' clock: "how long ago" redrawn on traffic, and every few seconds */
export function useNow(): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => onIo(() => setNow(Date.now())), []);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(t); }, []);
  return now;
}

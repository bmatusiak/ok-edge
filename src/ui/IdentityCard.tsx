/*
 * THE KEY'S IDENTITY AS ROWS - one card, drawn by the identity check after the unlock and by the Sync tab's Identity
 * panel (Brad, 2026-10-25: "identical code, so the bugs are fixed in 1 spot"). Label on the left, value in mono on the
 * right; a spinner while it is being read.
 */
import React from 'react';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';
import {theme} from './theme';

export type IdentityRow = {label: string; value: string; warn?: boolean};

export function IdentityCard({rows, checking = false, wide = false}: {rows: IdentityRow[]; checking?: boolean; wide?: boolean}) {
  return (
    <View style={[styles.card, wide && styles.wide]}>
      {rows.map(r => (
        <View key={r.label} style={styles.row}>
          <Text style={styles.rowLabel}>{r.label}</Text>
          <Text style={[styles.rowValue, r.warn && {color: theme.warn}]} selectable>{r.value}</Text>
        </View>
      ))}
      {checking ? <ActivityIndicator style={styles.spinner} color={theme.textDim} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
  /* inside a tab's section: the section's width, no gap above */
  wide: {marginTop: 0, maxWidth: '100%'},
  row: {flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 6},
  rowLabel: {color: theme.textDim, fontSize: 12},
  rowValue: {color: theme.textSecondary, fontSize: 12, fontFamily: theme.mono, flexShrink: 1, textAlign: 'right'},
  spinner: {paddingVertical: 8},
});

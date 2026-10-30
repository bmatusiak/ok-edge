/*
 * THE ACTIVITY TAB (Brad, 2026-10-29: "a single activity panel, containing all icons so they're not spaced or separated -
 * a press on any icon takes you to the same panel now"): one card per channel this device talks on, each leading on to
 * its own tab. The cards are the channels' own (src/features/channels: Bluetooth, Sync, MCP, the desktop's pipe to the
 * CLI) - this screen draws whichever this platform's list registered (PROPOSAL-rectify-ok-edge.md R0), and names none.
 */
import React, {Fragment} from 'react';
import {ScrollView, StyleSheet, Text} from 'react-native';
import {theme} from '../ui/theme';
import {ACTIVITY_NOTE} from '../platform';
import {pluginChannels} from '../plugins/registry';
import type {ChannelContext} from '../plugins/types';

export function ActivityScreen({ctx}: {ctx: ChannelContext}) {
  return (
    <ScrollView contentContainerStyle={styles.page}>
      {pluginChannels().map(c => <Fragment key={c.name}>{c.card(ctx)}</Fragment>)}
      {ACTIVITY_NOTE ? <Text style={styles.note}>{ACTIVITY_NOTE}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {padding: 16, gap: 12},
  note: {color: theme.textDim, fontSize: 12, paddingHorizontal: 4},
});

/*
 * A NEWER BUILD OF THE WEB APP IS OUT (src/webUpdate.ts; Brad, 2026-10-29: "after a user login has happened, no auto
 * reload, because that logs them out - so a sheet popup with dismiss and reload"; "a banner may not be seen, so a sheet
 * is better"). Reload clears this build's cache and worker and loads the newer one - the person logs in again; Dismiss
 * leaves this build running until the next time the tab comes to the front.
 */
import React, {useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Sheet} from './Sheet';
import {Btn} from './components';
import {theme} from './theme';
import {onOutdated, reloadFresh} from '../webUpdate';

export function UpdateSheet() {
  const [newer, setNewer] = useState<string | null>(null);
  useEffect(() => onOutdated(setNewer), []);
  if (!newer) return null;
  return (
    <Sheet title="A newer version is out" onClose={() => setNewer(null)}>
      <Text style={styles.note}>
        This page is an older build of the app. Reload loads the newer one - you will log in again. Dismiss keeps this one
        open for now.
      </Text>
      <View style={styles.buttons}>
        <Btn title="Reload" tone="primary" onPress={() => { void reloadFresh(); }} />
        <Btn title="Dismiss" onPress={() => setNewer(null)} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  note: {color: theme.textDim, fontSize: 13, lineHeight: 18},
  buttons: {gap: 8, marginTop: 8},
});

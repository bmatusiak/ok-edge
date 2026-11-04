/*
 * A NEWER VERSION IS OUT - one sheet for every shell, from the one place a release says what it is (/release.json):
 *   the web app (src/webUpdate.ts): a newer build is served - Reload loads it (Brad, 2026-10-29: "after a user login has
 *     happened, no auto reload, because that logs them out - so a sheet popup with dismiss and reload");
 *   the phone and the desktop (src/appUpdate.ts): a newer release is published - Download opens this device's package
 *     (Brad, 2026-11-04: "update notices have a unified place to check").
 * Dismiss leaves this build running: the web app asks again when the tab comes to the front; the apps not for this version.
 */
import React, {useEffect, useState} from 'react';
import {Linking, StyleSheet, Text, View} from 'react-native';
import {Sheet} from './Sheet';
import {Btn} from './components';
import {theme} from './theme';
import {onOutdated, reloadFresh} from '../webUpdate';
import {dismissAppUpdate, onAppUpdate, type AppUpdate} from '../appUpdate';

const mb = (n: number) => `${(n / (1024 * 1024)).toFixed(0)} MB`;

export function UpdateSheet() {
  const [newer, setNewer] = useState<string | null>(null);
  const [app, setApp] = useState<AppUpdate | null>(null);
  useEffect(() => onOutdated(setNewer), []);
  useEffect(() => onAppUpdate(setApp), []);
  if (newer) {
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
  if (!app) return null;
  const dismiss = () => { dismissAppUpdate(app.version); setApp(null); };
  return (
    <Sheet title="A newer version is out" onClose={dismiss}>
      <Text style={styles.note}>{`ok-edge ${app.version} is published - you have ${app.mine}.`}</Text>
      <Text style={styles.file}>{`${app.app.file} · ${mb(app.app.size)}`}</Text>
      <Text style={styles.note}>Download saves it; install it over this one. Dismiss skips this version.</Text>
      <View style={styles.buttons}>
        <Btn title="Download" tone="primary" onPress={() => { void Linking.openURL(app.app.url); }} />
        <Btn title="Dismiss" onPress={dismiss} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  note: {color: theme.textDim, fontSize: 13, lineHeight: 18},
  file: {color: theme.textSecondary, fontSize: 12, fontFamily: theme.mono},
  buttons: {gap: 8, marginTop: 8},
});

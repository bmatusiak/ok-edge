/**
 * DOWNLOADS (Brad, 2026-10-27: "convert the download button to its own page, put it in its own tab with back button,
 * and put the panel in there, and create a new panel for the android apk").
 *
 * Opened from the web app's login page. Each panel reads its manifest beside the web app (what the release workflow
 * publishes): the firmware for a developer key (FirmwareDownload.tsx) and the Android app (AndroidDownload.tsx). A
 * panel whose manifest is not there is left out; with neither, the page says so.
 */
import React, {useEffect} from 'react';
import {BackHandler, ScrollView, StyleSheet, Text, View} from 'react-native';
import {Btn, Section} from '../ui/components';
import {theme} from '../ui/theme';
import {FirmwareDownload, useFirmwareManifest} from './FirmwareDownload';
import {AndroidDownload, useAndroidManifest} from './AndroidDownload';

export function DownloadsPage({onBack}: {onBack: () => void}) {
  const firmware = useFirmwareManifest();
  const android = useAndroidManifest();
  /* a phone's own Back goes back too, as the ‹ Back button does (the web app has none; harmless there) */
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onBack(); return true; });
    return () => sub.remove();
  }, [onBack]);

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.row}>
        <Btn title="‹ Back" onPress={onBack} />
        <Text style={styles.title}>Downloads</Text>
      </View>
      {android ? (
        <Section title="Android app">
          <AndroidDownload m={android} />
        </Section>
      ) : null}
      {firmware ? (
        <Section title="Firmware for a developer key">
          <FirmwareDownload m={firmware} />
        </Section>
      ) : null}
      {!android && !firmware ? <Text style={styles.dim}>Nothing is published beside this web app yet.</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {padding: 16, gap: 12, width: '100%', maxWidth: 720, alignSelf: 'center'},
  row: {flexDirection: 'row', alignItems: 'center', gap: 16},
  title: {color: theme.text, fontSize: 18, fontWeight: '700'},
  dim: {color: theme.textDim, fontSize: 13},
});

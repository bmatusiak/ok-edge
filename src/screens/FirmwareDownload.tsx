/**
 * THE FIRMWARE THIS WEB APP WORKS WITH, FOR A DEVELOPER KEY (Brad, 2026-10-26: "a button at the bottom on the version
 * login page that downloads the firmware hex file ... i send a link to the main maintainer, he can download the hex
 * firmware file to upload on his developer key").
 *
 * The server publishes it beside the web app: /firmware/manifest.json names the .hex and says what it is built from
 * (firmware and libraries commits, the plugins - ctap_bridge is what lets a browser reach the key) and its sha256, shown
 * here so the file can be checked after the download. No manifest (the phone, the desktop, a server that publishes
 * none): nothing is shown. Since 2026-10-27 it is a panel of the Downloads page (DownloadsPage.tsx), which the login
 * page opens (Brad: "convert the download button to its own page ... with a back button").
 *
 * A DEVELOPER key only: a production OnlyKey loads signed firmware alone, and this is not signed.
 *
 * THE PROD HEX ONLY (Brad, 2026-10-28: "the test hex is not displayed on the webapp to download, only in the github
 * release section"; "hard to accidentally install, not directly pointed at from the apps"): the release workflow builds
 * a prod hex (no debug console) and a test hex (DANGEROUS-..., its debug console prints key data); the web app's
 * manifest lists the prod build alone (tools/firmware.js prod-only), and this page offers nothing else.
 */
import React, {useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Btn} from '../ui/components';
import {theme} from '../ui/theme';
import {shell} from '../platform';

/* one built hex: the web app's manifest lists the prod one alone */
export type FirmwareBuild = {
  flavor: 'prod' | 'test';
  file: string;
  sha256: string;
  debug: boolean;
  /* false until this exact file has run on a hard key: said on the page, never left out */
  tested: boolean;
  testedOn?: string;
};

export type Manifest = {
  version: string;
  firmware: string;
  libraries: string;
  plugins: string[];
  builds: FirmwareBuild[];
  site?: string;
  /* the maintainer patches staged on the pins (emulator scripts/versions/patches-3.1.0) */
  fixes?: string[];
  /* one hash of everything the hex is built from (tools/firmware.js): same inputs, same hash */
  buildHash?: string;
};

const BASE = '/firmware/';
const HEX_NAME = /^[\w.-]+\.hex$/;

/** the prod build of a manifest - the only one the page offers - or null */
const prodOf = (m: Manifest) =>
  m.builds.find(b => b.flavor === 'prod' && !b.debug && HEX_NAME.test(b.file) && !b.file.startsWith('DANGEROUS')) ?? null;

/** the manifest beside the web app; null when there is none (the phone, the desktop, a server that publishes none) */
export function useFirmwareManifest(): Manifest | null {
  const [m, setM] = useState<Manifest | null>(null);
  useEffect(() => {
    if (shell !== 'webapp') return;
    let alive = true;
    fetch(BASE + 'manifest.json', {cache: 'no-store'})
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        if (alive && j && Array.isArray(j.builds) && prodOf(j as Manifest)) setM(j as Manifest);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return m;
}

/* the Downloads page's firmware panel (DownloadsPage.tsx) */
export function FirmwareDownload({m}: {m: Manifest}) {
  const b = prodOf(m)!;
  /* an anchor with `download`: the browser saves the file instead of showing a page of hex text */
  const download = () => {
    const a = document.createElement('a');
    a.href = BASE + b.file;
    a.download = b.file;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <View style={styles.box}>
      <Btn title="Download firmware for a developer key (.hex)" onPress={download} />
      <Text style={styles.line}>
        OnlyKey {m.version} · firmware {m.firmware} · libraries {m.libraries} · prod (no debug console)
      </Text>
      <Text style={styles.line}>plugins: {m.plugins.join(', ')}</Text>
      {m.fixes && m.fixes.length ? <Text style={styles.line}>fixes: {m.fixes.join(', ')}</Text> : null}
      {m.site ? <Text style={styles.line}>allowed site: {m.site}</Text> : null}
      {b.tested && b.testedOn ? (
        <Text style={styles.line}>tested: {b.testedOn}</Text>
      ) : (
        <Text style={styles.warn}>not yet tested on a hard key</Text>
      )}
      {m.buildHash ? <Text style={styles.line}>build {m.buildHash}</Text> : null}
      <Text style={styles.line} selectable>
        {b.file}
      </Text>
      <Text style={styles.line} selectable>
        sha256 {b.sha256}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {gap: 4, alignItems: 'stretch'},
  line: {color: theme.textDim, fontSize: 11, lineHeight: 15},
  warn: {color: theme.warn, fontSize: 11, lineHeight: 15},
});

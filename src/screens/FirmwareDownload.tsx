/**
 * THE FIRMWARE THIS WEB APP WORKS WITH, FOR A DEVELOPER KEY (Brad, 2026-10-26: "a button at the bottom on the version
 * login page that downloads the firmware hex file ... i send a link to the main maintainer, he can download the hex
 * firmware file to upload on his developer key").
 *
 * The server publishes it beside the web app: /firmware/manifest.json names the .hex and says what it is built from
 * (firmware and libraries commits, the plugins - ctap_bridge is what lets a browser reach the key - DEBUG or not) and
 * its sha256, shown here so the file can be checked after the download. No manifest (the phone, the desktop, a server
 * that publishes none): nothing is shown.
 *
 * A DEVELOPER key only: a production OnlyKey loads signed firmware alone, and this is not signed.
 */
import React, {useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Btn} from '../ui/components';
import {theme} from '../ui/theme';
import {shell} from '../platform';

type Manifest = {
  file: string;
  version: string;
  firmware: string;
  libraries: string;
  plugins: string[];
  debug: boolean;
  sha256: string;
  site?: string;
  /* the maintainer patches staged on the pins (emulator scripts/versions/patches-3.1.0) */
  fixes?: string[];
  /* one hash of everything the hex is built from (tools/firmware.js): same inputs, same hash */
  buildHash?: string;
  /* false until this exact file has run on a hard key: said on the page, never left out */
  tested?: boolean;
  testedOn?: string;
};

const BASE = '/firmware/';

export function FirmwareDownload() {
  const [m, setM] = useState<Manifest | null>(null);
  useEffect(() => {
    if (shell !== 'webapp') return;
    let alive = true;
    fetch(BASE + 'manifest.json', {cache: 'no-store'})
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        if (alive && j && typeof j.file === 'string' && /^[\w.-]+\.hex$/.test(j.file)) setM(j as Manifest);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  if (!m) return null;

  /* an anchor with `download`: the browser saves the file instead of showing a page of hex text */
  const download = () => {
    const a = document.createElement('a');
    a.href = BASE + m.file;
    a.download = m.file;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <View style={styles.box}>
      <Btn title="Download firmware for a developer key (.hex)" onPress={download} />
      <Text style={styles.line}>
        OnlyKey {m.version} · firmware {m.firmware} · libraries {m.libraries}
        {m.debug ? ' · DEBUG' : ''}
      </Text>
      <Text style={styles.line}>plugins: {m.plugins.join(', ')}</Text>
      {m.fixes && m.fixes.length ? <Text style={styles.line}>fixes: {m.fixes.join(', ')}</Text> : null}
      {m.site ? <Text style={styles.line}>allowed site: {m.site}</Text> : null}
      {m.tested === false ? <Text style={styles.warn}>not yet tested on a hard key</Text> : null}
      {m.tested && m.testedOn ? <Text style={styles.line}>tested: {m.testedOn}</Text> : null}
      {m.buildHash ? <Text style={styles.line}>build {m.buildHash}</Text> : null}
      <Text style={styles.line} selectable>
        sha256 {m.sha256}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {width: '100%', maxWidth: 420, gap: 4, alignItems: 'stretch'},
  line: {color: theme.textDim, fontSize: 11, textAlign: 'center', lineHeight: 15},
  warn: {color: theme.warn, fontSize: 11, textAlign: 'center', lineHeight: 15},
});

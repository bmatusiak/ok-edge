/**
 * THE ANDROID APP, FROM THE WEB APP (Brad, 2026-10-27: "i want to put a prod-release apk on the webapp so it can be
 * downloaded or updated from the webapp").
 *
 * The APK itself is a GitHub release asset (a Cloudflare Worker serves files of 25 MiB at most); the release workflow
 * (.github/workflows/release.yml) publishes beside the web app /android/manifest.json: which build, where its file is,
 * and what to check it against - its sha256, and the SHA-256 of the certificate it is signed with. Android installs it
 * over the app already on the phone only when that app carries the same id (com.okrn) and the same signing certificate,
 * and a higher version - so the certificate is shown, not just the file's hash. No manifest (a server that publishes
 * none, the phone, the desktop): nothing is shown.
 */
import React, {useEffect, useState} from 'react';
import {Linking, StyleSheet, Text, View} from 'react-native';
import {Btn} from '../ui/components';
import {theme} from '../ui/theme';
import {shell} from '../platform';

export type AndroidManifest = {
  appId: string;
  version: string;
  versionCode: number;
  /* the release asset: its file name and its full download address */
  file: string;
  url: string;
  sha256: string;
  size: number;
  /* the SHA-256 of the signing certificate (apksigner's "certificate SHA-256 digest") */
  certSha256: string;
  /* debug: signed with the repo's debug keystore (until the OnlyKey signs releases through Edge) */
  signedWith?: string;
  commit?: string;
  builtAt?: string;
};

const MANIFEST = '/android/manifest.json';

const mb = (n: number) => `${(n / (1024 * 1024)).toFixed(1)} MB`;
const pairs = (hex: string) => hex.toUpperCase().match(/../g)?.join(':') ?? hex;

/** the manifest beside the web app, checked for the fields the panel shows; null when there is none */
export function useAndroidManifest(): AndroidManifest | null {
  const [m, setM] = useState<AndroidManifest | null>(null);
  useEffect(() => {
    if (shell !== 'webapp') return;
    let alive = true;
    fetch(MANIFEST, {cache: 'no-store'})
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        if (alive && j && typeof j.url === 'string' && /^https:\/\//.test(j.url) && /\.apk$/.test(String(j.file))) setM(j as AndroidManifest);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return m;
}

export function AndroidDownload({m}: {m: AndroidManifest}) {
  return (
    <View style={styles.box}>
      <Text style={styles.body}>
        The OnlyKey app for Android, {m.version} (build {m.versionCode}). On a phone that already has it, this installs as an
        update and keeps the app's soft key and data - Android allows that only for the same app ({m.appId}) signed with the
        same certificate.
      </Text>
      {/* a GitHub address: the browser downloads it (a cross-site file cannot be named by `download`) */}
      <Btn title={`Download the app (.apk, ${mb(m.size)})`} tone="primary" onPress={() => void Linking.openURL(m.url)} />
      <Text style={styles.line}>{m.file}</Text>
      {m.commit ? <Text style={styles.line}>built from {m.commit}{m.builtAt ? ` · ${m.builtAt.slice(0, 10)}` : ''}</Text> : null}
      {m.signedWith ? <Text style={styles.warn}>signed with {m.signedWith}</Text> : null}
      <Text style={styles.line} selectable>
        sha256 {m.sha256}
      </Text>
      <Text style={styles.line} selectable>
        signing certificate SHA-256 {pairs(m.certSha256)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {gap: 6, alignItems: 'stretch'},
  body: {color: theme.text, fontSize: 13, lineHeight: 19},
  line: {color: theme.textDim, fontSize: 11, lineHeight: 15},
  warn: {color: theme.warn, fontSize: 11, lineHeight: 15},
});

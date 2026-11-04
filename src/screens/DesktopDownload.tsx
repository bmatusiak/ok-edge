/**
 * THE DESKTOP APP, FROM THE WEB APP (Brad, 2026-10-28: "desktop package = go, linux and windows separated packages";
 * the Downloads order "1 source code, 2 firmware, 3 android apk, 4 desktop package, 5 cli").
 *
 * The packages are GitHub release assets, one per system (tools/release/desktop-package.js builds each on a runner of
 * that system); the release workflow publishes beside the web app /release.json (apps.desktop, src/release.ts), each its
 * file, download address, sha256 and size. Unpacked and run where it lands - no installer.
 *
 * What each system needs is said here, not left to be found out:
 *   Windows  the package is not code-signed yet, so SmartScreen asks once ("More info" -> "Run anyway")
 *   Linux    a key on USB needs the OnlyKey udev rules. The soft key needs nothing: its flash maps wherever the kernel
 *            puts it, as on Windows and Android (the emulator's src/ok_hal.cpp, 2026-10-28), so no vm.mmap_min_addr
 *            setting is asked of the user.
 */
import React from 'react';
import {Linking, StyleSheet, Text, View} from 'react-native';
import {Btn} from '../ui/components';
import {theme} from '../ui/theme';
import {useRelease} from '../release';

export type DesktopPackage = {
  os: 'windows' | 'linux';
  arch: string;
  file: string;
  url: string;
  sha256: string;
  size: number;
  version: string;
  versionCode: number;
  commit?: string;
  builtAt?: string;
  softKey?: {version: string; plugins: string[]};
};

const mb = (n: number) => `${(n / (1024 * 1024)).toFixed(0)} MB`;

/** the release's desktop packages (/release.json, src/release.ts), each checked for what the panel uses; null when there are none */
export function useDesktopManifest(): DesktopPackage[] | null {
  const r = useRelease();
  if (!r) return null;
  const ok = (['windows', 'linux'] as const)
    .map(os => ({os, a: r.apps.desktop?.[os]}))
    .filter(({a}) => a && /^https:\/\//.test(a.url))
    .map(({os, a}) => ({os, arch: 'x64', file: a!.file, url: a!.url, sha256: a!.sha256, size: a!.size, version: r.version, versionCode: r.code, commit: a!.commit, softKey: a!.softKey}));
  return ok.length ? ok : null;
}

const HOW: Record<DesktopPackage['os'], {title: string; steps: string}> = {
  windows: {
    title: 'Windows',
    steps:
      'Unzip it anywhere and run ok-edge.exe. It is not code-signed yet, so Windows asks the first time: More info, then Run anyway.',
  },
  linux: {
    title: 'Linux',
    steps: 'Unpack it anywhere (tar xzf) and run ./ok-edge. A key on USB needs the OnlyKey udev rules.',
  },
};

export function DesktopDownload({packages}: {packages: DesktopPackage[]}) {
  const first = packages[0];
  return (
    <View style={styles.box}>
      <Text style={styles.body}>
        The OnlyKey desktop app, {first.version} (build {first.versionCode}): a hard key on USB, the app's own soft key,
        and sync with your phone. One download per system; nothing to install - it runs from the folder you unpack it to.
      </Text>
      {packages.map(p => (
        <View key={p.os} style={styles.pkg}>
          <Btn
            title={`Download for ${HOW[p.os].title} (${p.arch}, ${mb(p.size)})`}
            tone="primary"
            onPress={() => void Linking.openURL(p.url)}
          />
          <Text style={styles.body}>{HOW[p.os].steps}</Text>
          <Text style={styles.line}>{p.file}</Text>
          <Text style={styles.line} selectable>
            sha256 {p.sha256}
          </Text>
        </View>
      ))}
      {first.commit ? <Text style={styles.line}>built from {first.commit}{first.builtAt ? ` · ${first.builtAt.slice(0, 10)}` : ''}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {gap: 10, alignItems: 'stretch'},
  pkg: {gap: 6},
  body: {color: theme.text, fontSize: 13, lineHeight: 19},
  line: {color: theme.textDim, fontSize: 11, lineHeight: 15},
});

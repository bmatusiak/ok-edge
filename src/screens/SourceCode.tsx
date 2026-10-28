/**
 * SOURCE CODE, AT THE TOP OF DOWNLOADS (Brad, 2026-10-28: "i need a panel at the top of downloads tab, "Source Code"
 * where the user can find the source code, repo").
 *
 * The repositories every download on this page is built from, each a link to GitHub. Fixed text, not a manifest: the
 * repositories do not change from release to release. The one thing that does - which commit of ok-edge this release
 * was built from - comes from the Android manifest beside it (its `commit`), when there is one.
 */
import React from 'react';
import {Linking, StyleSheet, Text, View} from 'react-native';
import {Btn} from '../ui/components';
import {theme} from '../ui/theme';

const GITHUB = 'https://github.com/bmatusiak';

/* what each repository holds, in the order a reader goes from the app down to the key */
const REPOS: {name: string; what: string}[] = [
  {name: 'ok-edge', what: 'this app - Android, desktop and this web app, and its server'},
  {name: 'node-onlykey-lib', what: 'the library every app talks to the key through, and the onlykey-js command line'},
  {name: 'node-onlykey-emulator', what: 'the soft key, and the firmware plugins (Edge) the developer firmware is built with'},
  {name: 'onlykey-js', what: 'the command line installer (below)'},
];

export function SourceCode({commit}: {commit?: string}) {
  return (
    <View style={styles.box}>
      <Text style={styles.body}>Everything on this page is built from these open-source repositories on GitHub.</Text>
      {REPOS.map(r => (
        <View key={r.name} style={styles.repo}>
          <Btn title={r.name} onPress={() => void Linking.openURL(`${GITHUB}/${r.name}`)} />
          <Text style={styles.what}>{r.what}</Text>
        </View>
      ))}
      {commit ? (
        <Text style={styles.line} selectable>
          this release: ok-edge {commit.slice(0, 7)} - {GITHUB}/ok-edge/tree/{commit}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {gap: 8, alignItems: 'stretch'},
  body: {color: theme.text, fontSize: 13, lineHeight: 19},
  repo: {flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap'},
  what: {color: theme.textDim, fontSize: 12, lineHeight: 17, flexShrink: 1},
  line: {color: theme.textDim, fontSize: 11, lineHeight: 15},
});

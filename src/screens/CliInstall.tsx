/**
 * THE COMMAND LINE, FROM DOWNLOADS (Brad, 2026-10-28: "in the downloads tab in the app, can we make a panel to tell the
 * user how to install the cli"; "no npmjs publish").
 *
 * How to install onlykey-js: npm installs it straight from the bmatusiak/onlykey-js GitHub repository, which pins
 * node-onlykey-lib at a tested commit together with prebuilt native modules - so nothing is compiled and no build
 * tools are needed (the onlykey-js README says why each module is there). Fixed text: the install command is the same
 * for every release; running it again updates.
 */
import React from 'react';
import {Linking, StyleSheet, Text, View} from 'react-native';
import {Btn} from '../ui/components';
import {theme} from '../ui/theme';

const INSTALL = 'npm install -g bmatusiak/onlykey-js';

export function CliInstall() {
  return (
    <View style={styles.box}>
      <Text style={styles.body}>
        onlykey-js is the OnlyKey from a terminal, on Windows, Linux and macOS: the key's status, SSH and GPG through the
        key, and Edge budgets. It needs Node.js 22 or newer and git. Install it (run the same again to update):
      </Text>
      <Text style={styles.code} selectable>
        {INSTALL}
      </Text>
      <Text style={styles.body}>Then:</Text>
      <Text style={styles.code} selectable>
        {'onlykey-js status\nonlykey-js --help'}
      </Text>
      <Text style={styles.line}>
        It is not on the npm registry: npm reads bmatusiak/onlykey-js as the GitHub repository. Every native module comes
        prebuilt, so no build tools are needed. On Linux a USB key needs the OnlyKey udev rules.
      </Text>
      <Btn title="Node.js downloads" onPress={() => void Linking.openURL('https://nodejs.org/en/download')} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {gap: 6, alignItems: 'stretch'},
  body: {color: theme.text, fontSize: 13, lineHeight: 19},
  code: {color: theme.text, fontSize: 13, fontFamily: theme.mono, backgroundColor: theme.inputBg, padding: 8, borderRadius: theme.radius},
  line: {color: theme.textDim, fontSize: 11, lineHeight: 15},
});

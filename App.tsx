/**
 * Stage 1: the one screen every shell shows - which shell it is, which library it runs on, and
 * which services it has. No features yet (PROPOSAL-one-gui.md, stage 1). Light or dark as the
 * system is set (the Pixel runs dark; fixed dark text on it was unreadable).
 */
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { startApp, CAPABILITIES, type App as OkApp } from './src/app';
import { shell } from './src/platform';

const PALETTE = {
  light: { bg: '#ffffff', text: '#111111', dim: '#555555', line: '#dddddd' },
  dark: { bg: '#1b1b1b', text: '#f2f2f2', dim: '#a8a8a8', line: '#3a3a3a' },
};

export default function App() {
  const [app, setApp] = useState<OkApp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const styles = useMemo(() => makeStyles(PALETTE[scheme]), [scheme]);

  useEffect(() => {
    startApp().then(setApp, (e: Error) => setError(e.message));
  }, []);

  const services = app ? Object.keys(app.services).filter((n) => n !== 'app') : [];
  const lib = app ? (app.services.lib as { version: string }).version : '…';
  const about = app && app.services.desktop ? (app.services.desktop as { about: Record<string, string> }).about : null;
  const Row = ({ k, v }: { k: string; v: string }) => (
    <View style={styles.row}>
      <Text style={styles.k}>{k}</Text>
      <Text style={styles.v}>{v}</Text>
    </View>
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.page}>
      <Text style={styles.title}>ok-edge</Text>
      <Text style={styles.sub}>1 lib, 1 GUI, any platform - stage 1</Text>

      <View style={styles.card}>
        <Row k="shell" v={shell} />
        <Row k="library" v={`node-onlykey-lib ${lib}`} />
        {about && <Row k="desktop" v={`Electron ${about.electron}, Node ${about.node}, ${about.platform}`} />}
        {error && <Row k="start failed" v={error} />}
      </View>

      <Text style={styles.head}>Services here</Text>
      <View style={styles.card}>
        {services.map((s) => <Row key={s} k={s} v="present" />)}
      </View>

      <Text style={styles.head}>Capabilities</Text>
      <View style={styles.card}>
        {Object.entries(CAPABILITIES).map(([name, c]) => (
          <Row key={name} k={name} v={c[shell] ? `stage ${c[shell]}` : 'not on this shell'} />
        ))}
      </View>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </ScrollView>
  );
}

function makeStyles(p: (typeof PALETTE)['light']) {
  return StyleSheet.create({
    screen: { backgroundColor: p.bg },
    page: { padding: 24, paddingTop: 56, gap: 8 },
    title: { fontSize: 28, fontWeight: '700', color: p.text },
    sub: { color: p.dim, marginBottom: 8 },
    head: { fontSize: 16, fontWeight: '600', marginTop: 12, color: p.text },
    card: { borderWidth: 1, borderColor: p.line, borderRadius: 8, padding: 12, gap: 6 },
    row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
    k: { color: p.dim },
    v: { fontFamily: 'monospace', flexShrink: 1, textAlign: 'right', color: p.text },
  });
}

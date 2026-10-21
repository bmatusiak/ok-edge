/**
 * Stage 1: the one screen every shell shows - which shell it is, which library it runs on, and
 * which services it has. No features yet (PROPOSAL-one-gui.md, stage 1).
 */
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { startApp, CAPABILITIES, type App as OkApp } from './src/app';
import { shell } from './src/platform';

export default function App() {
  const [app, setApp] = useState<OkApp | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startApp().then(setApp, (e: Error) => setError(e.message));
  }, []);

  const services = app ? Object.keys(app.services).filter((n) => n !== 'app') : [];
  const lib = app ? (app.services.lib as { version: string }).version : '…';
  const about = app && app.services.desktop ? (app.services.desktop as { about: Record<string, string> }).about : null;

  return (
    <ScrollView contentContainerStyle={styles.page}>
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
      <StatusBar style="auto" />
    </ScrollView>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.k}>{k}</Text>
      <Text style={styles.v}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 24, paddingTop: 56, gap: 8 },
  title: { fontSize: 28, fontWeight: '700' },
  sub: { color: '#666', marginBottom: 8 },
  head: { fontSize: 16, fontWeight: '600', marginTop: 12 },
  card: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  k: { color: '#555' },
  v: { fontFamily: 'monospace', flexShrink: 1, textAlign: 'right' },
});

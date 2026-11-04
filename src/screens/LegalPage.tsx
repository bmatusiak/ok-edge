/*
 * THE LEGAL PAGE (Brad, 2026-11-04: "a legal button that opens a legal page that shows licences, contributors and
 * stuff"), opened from the Log in page. Everything on it is the generated about.json (tools/legal/gen-about.js): the
 * app's license and notice, the people who asked to be listed (CONTRIBUTORS), where the source is, the OnlyKey firmware's
 * license and the acknowledgment it requires, its libraries' licenses, and every package the app carries with its own.
 * The long texts open on a tap, so the page reads top to bottom without scrolling through them.
 */
import React, {useEffect, useState} from 'react';
import {BackHandler, ScrollView, StyleSheet, Text, View} from 'react-native';
import {Btn, Section} from '../ui/components';
import {theme} from '../ui/theme';
import {about} from '../about';

/* a long text, shown on a tap */
function Long({label, text}: {label: string; text: string}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.long}>
      <Btn title={open ? `Hide ${label}` : `Show ${label}`} onPress={() => setOpen(o => !o)} />
      {open ? <Text style={styles.mono} selectable>{text}</Text> : null}
    </View>
  );
}

export function LegalPage({onBack}: {onBack: () => void}) {
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onBack(); return true; });
    return () => sub.remove();
  }, [onBack]);

  if (!about) {
    return (
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.row}>
          <Btn title="‹ Back" onPress={onBack} />
          <Text style={styles.title}>Legal</Text>
        </View>
        <Text style={styles.text}>This build carries no legal record (src/generated/about.json was not made at bundle time).</Text>
      </ScrollView>
    );
  }
  const a = about;
  /* the packages by license, most used first */
  const byLicense = new Map<string, string[]>();
  for (const p of a.packages) byLicense.set(p.license, [...(byLicense.get(p.license) ?? []), `${p.name} ${p.version}`]);
  const groups = [...byLicense.entries()].sort((x, y) => y[1].length - x[1].length || x[0].localeCompare(y[0]));

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.row}>
        <Btn title="‹ Back" onPress={onBack} />
        <Text style={styles.title}>Legal</Text>
      </View>

      <Section title={`${a.app.name} ${a.app.version}`}>
        <Text style={styles.text} selectable>{a.app.notice}</Text>
        <Long label="the Apache License 2.0" text={a.apache} />
      </Section>

      <Section title="Contributors">
        <Text style={styles.dim}>The people who worked on {a.app.name} and asked to be listed.</Text>
        {a.contributors.map(c => <Text key={c} style={styles.text}>{c}</Text>)}
      </Section>

      <Section title="The OnlyKey firmware">
        <Text style={styles.dim}>The app runs the OnlyKey firmware as its built-in soft key.</Text>
        <Text style={styles.text} selectable>{a.firmware.acknowledgment}</Text>
        <Long label="its license" text={a.firmware.license} />
        <Long label="its libraries' licenses" text={a.firmware.libraries} />
      </Section>

      <Section title="Source code">
        {a.source.map(s => (
          <View key={s.where} style={styles.source}>
            <Text style={styles.text}>{s.what}</Text>
            <Text style={styles.mono} selectable>{s.where}</Text>
          </View>
        ))}
      </Section>

      <Section title={`Open-source packages (${a.packages.length})`}>
        <Text style={styles.dim}>Every package the app carries, under its own license.</Text>
        {groups.map(([license, names]) => (
          <View key={license} style={styles.group}>
            <Text style={styles.text}>{`${license} (${names.length})`}</Text>
            <Text style={styles.dim} selectable>{names.join(', ')}</Text>
          </View>
        ))}
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {padding: 16, gap: 12, width: '100%', maxWidth: 720, alignSelf: 'center'},
  row: {flexDirection: 'row', alignItems: 'center', gap: 16},
  title: {color: theme.text, fontSize: 18, fontWeight: '700'},
  text: {color: theme.text, fontSize: 14, lineHeight: 20},
  dim: {color: theme.textDim, fontSize: 13, lineHeight: 19},
  mono: {color: theme.textSecondary, fontSize: 12, lineHeight: 17, fontFamily: theme.mono},
  long: {gap: 8, alignItems: 'flex-start'},
  source: {gap: 2},
  group: {gap: 2},
});

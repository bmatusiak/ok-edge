/**
 * THE AGENT IDENTITY in the Edge Management drawer (SPEC H7; Brad, 2026-10-20: "it should be
 * displayed in" the Edge Management pull-up tab; "computer sets, phone keeps").
 *
 * Read-only here: a computer sets it with `onlykey-js edge setup`, and the Edge sheet asks
 * before it is kept (src/edgeAgents.ts handleIdentity). The rows are the library's
 * (identity.rows), the same words the sheet shows and the CLI prints.
 */
import React, {useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {identity as identityLib} from 'node-onlykey-lib/edge';
import {loadKept, onIdentity, type KeptIdentity} from '../edgeIdentity';
import {DrawerArea} from './BottomDrawer';
import {desktop} from '../platform';
import {theme} from './theme';

/*
 * hardKey: the hard key on the desktop - the record the CLI's host keeps in the key's identity
 * (electron/desktop/hosting.js okedge:hardKeyIdentity), shown by THIS card with the same rows and
 * words, not a second card (one UI, Brad 2026-10-24).
 */
export function AgentIdentityCard({hardKey = false}: {hardKey?: boolean}) {
  const [kept, setKept] = useState<KeptIdentity | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    if (hardKey) {
      const shell = desktop;
      if (!shell) { setKept(null); return undefined; }
      void (shell.invoke('okedge:hardKeyIdentity') as Promise<{record?: KeptIdentity['record'] | null}>)
        .then(a => { if (live) setKept(a && a.record ? {record: a.record, setBy: null} : null); })
        .catch(() => { if (live) setKept(null); });
      return () => { live = false; };
    }
    void loadKept().then(k => { if (live) setKept(k); });
    const off = onIdentity(k => setKept(k));
    return () => { live = false; off(); };
  }, [hardKey]);
  if (kept === undefined) return null;
  return (
    <DrawerArea>
      <Text style={styles.name}>Agent identity</Text>
      {kept ? (
        <>
          {identityLib.rows(kept.record).map(([k, v]: [string, string]) => (
            <View key={k} style={styles.row}>
              <Text style={styles.key}>{k}</Text>
              <Text style={styles.value} selectable>{v}</Text>
            </View>
          ))}
          <Text style={styles.dim}>
            {hardKey
              ? 'onlykey-js uses it with this key; this computer keeps it in the key\'s identity. Change it: onlykey-js edge setup.'
              : `Every computer paired with this phone uses it${kept.setBy ? ` - set from ${kept.setBy.computer}` : ''}. Change it from a computer: onlykey-js edge setup.`}
          </Text>
        </>
      ) : (
        <Text style={styles.dim}>
          {hardKey
            ? 'None yet for this key. Set it once: onlykey-js edge setup --ssh ssh://user@host --gpg "Name <email>" - it shows here to approve.'
            : 'None yet. Set it once from a paired computer: onlykey-js edge setup --ssh ssh://user@host --gpg "Name <email>" - it shows here to approve.'}
        </Text>
      )}
    </DrawerArea>
  );
}

const styles = StyleSheet.create({
  name: {color: theme.text, fontWeight: '600', fontSize: 15},
  row: {flexDirection: 'row', gap: 10, paddingVertical: 2},
  key: {color: theme.textDim, fontSize: 13, width: 84},
  value: {color: theme.text, fontSize: 13, flex: 1},
  dim: {color: theme.textDim, fontSize: 13, lineHeight: 19},
});

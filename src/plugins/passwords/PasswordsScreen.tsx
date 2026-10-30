import React, {useCallback, useEffect, useState} from 'react';
import {Alert, BackHandler, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';

import {inner as innerLib} from 'node-onlykey-lib/passwords';
import NativeSecrets from 'okedge-native/specs/NativeSecrets';
import NativeShare from 'okedge-native/specs/NativeShare';
import {useSharedBtKeyboard} from '../../hooks/BtKeyboardContext';
import {BACKEND_NAME} from '../../hooks/keySession';
import {useSecureScreen} from '../../hooks/useSecureScreen';
import {getOnlyKey} from '../../onlykey';
import {SlotsScreen} from '../../screens/SlotsScreen';
import {Btn, KeyValue, Section, Segmented} from '../../ui/components';
import {EdgeList, type EdgeListItem} from '../../ui/EdgeList';
import {theme} from '../../ui/theme';
import type {TabContext} from '../types';
import {AutofillCard} from './autofill/AutofillCard';
import {EntryEditor} from './EntryEditor';
import {DerivedEntry, NewDerived} from './DerivedViews';
import {openEntry, sealEntry, stripInner} from './innerKeys';
import {NewPhrase, PhraseEntry} from './PhraseViews';
import {RowActions, type RowAction} from '../../ui/RowActions';
import {TotpCode} from './TotpViews';
import {usePasswordManager} from './usePasswordManager';
import type {Manager} from './stores';
import type {DeriveOkcrypto} from './innerKeys';
import type {PhraseOkcrypto} from './usePasswordManager';
import {SHOW_SCROLLBARS, shell} from '../../platform';
import {CLIPBOARD_TTL_MS} from '../../ui/sensitive';

/*
 * THE PASSWORDS TAB. The list opens with the store key (stores.ts: the key's touchless derive) - by
 * itself when its last open asked nothing, otherwise "Open passwords", so opening the tab never sends
 * a request that waits for the person (Brad, 2026-10-11). An entry's secrets open with a press, each
 * visit (innerKeys.ts; Brad, 2026-10-27: "press decrypt only"). The
 * list is Edge's scrollable list (src/ui/EdgeList.tsx; Brad: "we need to reuse the scrollable list
 * view we use in edge"). An entry and the editor open as a page with ‹ Back and its name, and the
 * phone's own Back goes back too, as Settings and Edge's budget view do.
 */

/* the kind filter's labels, and the entry kind each picks */
const KIND_FILTERS = ['All', 'Logins', 'Notes', 'Cards', 'Codes', 'Phrases'] as const;
type KindFilter = (typeof KIND_FILTERS)[number];
/* Logins also holds derived passwords: both sign in to a site */
const KIND_OF_FILTER: Record<Exclude<KindFilter, 'All'>, string[]> = {Logins: ['login', 'derived'], Notes: ['note'], Cards: ['card'], Codes: ['totp'], Phrases: ['mnemonic']};

const KIND_TITLE: Record<string, string> = {login: 'Logins', derived: 'Derived passwords', note: 'Notes', card: 'Cards', totp: 'Authenticators', mnemonic: 'Wallet phrases'};

type Entry = {
  id: string;
  kind: 'login' | 'note' | 'card' | 'mnemonic' | 'totp' | 'derived';
  totp?: any;
  recipe?: {label: string; out: string; press: boolean; check: string};
  title: string;
  username?: string;
  password?: string;
  urls?: string[];
  folder?: string;
  tags?: string[];
  /* apps linked by package + signing certificate (Autofill's Link this app) */
  androidApps?: {package: string; cert: string}[];
  notes?: string;
  history?: {password: string; changedAt: string}[];
  inner?: {seal: string; ref: string; blob: string};
  updatedAt?: string;
};

/* an entry opened on this visit: its secrets, and its key - so an edit seals again with no second press */
type Opened = {entry: Entry; key: Uint8Array};

type NewKind = 'login' | 'note' | 'card' | 'totp';
type Page =
  | {kind: 'list'}
  | {kind: 'add'; id: null}
  | {kind: 'entry'; id: string}
  | {kind: 'edit'; id: string | null; newKind?: NewKind}
  | {kind: 'phrase'; id: null}
  | {kind: 'derive-new'; id: null}
  | {kind: 'to-slot'; id: string};

const hostOf = (url: string) => url.replace(/^[a-z]+:\/\//i, '').split(/[/?#]/)[0];

async function copy(text: string | undefined, what: string) {
  if (!text) return;
  await NativeSecrets.copySensitive(text, CLIPBOARD_TTL_MS);
  Alert.alert('Copied', `${what} copied. The clipboard is cleared in ${CLIPBOARD_TTL_MS / 1000} seconds.`);
}

export function PasswordsScreen({ctx}: {ctx: TabContext}) {
  const {view, openWithKey, lockNow, retry, keyFor} = usePasswordManager({backend: ctx.backend, unlocked: ctx.unlocked});
  /* a phrase or a derived password is made with a press, as every secret here is */
  const phraseKey = async () => ({okcrypto: (await keyFor()) as PhraseOkcrypto, press: true});
  const keyName = BACKEND_NAME[ctx.backend];
  useSecureScreen(ctx.blockScreenshots && view.state === 'open');

  /* an authenticator's setup key into one of the active key's TOTP slots (lib device.totpFields, as the slot editor writes it) */
  const writeSlot = async (slotId: string, secret: string) => {
    const {device} = await getOnlyKey(ctx.backend);
    await device.setSlot(slotId, device.totpFields(secret));
  };
  /* passwords a sync brings are read in by the store itself (usePasswordWatch: reload with the key it holds) */
  if (view.state === 'open') return <OpenStore manager={view.manager} identity={view.identity} keyName={keyName} lockNow={lockNow} keyFor={keyFor} phraseKey={phraseKey} writeSlot={writeSlot} />;

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <Section title="Passwords">
        {view.state === 'locked-key' ? (
          <Text style={styles.body}>Unlock the {keyName} to see its passwords.</Text>
        ) : view.state === 'no-bucket' ? (
          <Text style={styles.body}>No identity's bucket is open: passwords live in it. Continue past the identity check first.</Text>
        ) : view.state === 'checking' ? (
          <Text style={styles.body}>Opening…</Text>
        ) : view.state === 'pressing' ? (
          <Text style={styles.body}>Opening your passwords - if the key asks, enter its code or press it.</Text>
        ) : view.state === 'button' ? (
          <>
            <Text style={styles.body}>
              {`Your passwords are sealed to the ${keyName}. Opening asks the key once - its code or a press, as its derive setting says, or nothing once that is set to none; the list then stays open until the key locks. Each password opens with a press.`}
            </Text>
            <Btn title="Open passwords" tone="primary" onPress={openWithKey} />
          </>
        ) : (
          <>
            <Text style={[styles.body, {color: theme.error}]}>{view.message}</Text>
            <Btn title="Try again" onPress={retry} />
          </>
        )}
      </Section>
    </ScrollView>
  );
}

function OpenStore({
  manager,
  identity,
  keyName,
  lockNow,
  keyFor,
  phraseKey,
  writeSlot,
}: {
  manager: Manager;
  /* the bucket identity: an entry's press derive is scoped to it (innerKeys.ts) */
  identity: string;
  keyName: string;
  lockNow: () => void;
  keyFor: () => Promise<DeriveOkcrypto>;
  phraseKey: Parameters<typeof PhraseEntry>[0]['phraseKey'];
  writeSlot: (slotId: string, secret: string) => Promise<void>;
}) {
  const [page, setPage] = useState<Page>({kind: 'list'});
  /*
   * Entries opened with their press while their page is up: the entry with its secrets, and its key.
   * In memory only; the keys are wiped and the secrets dropped when the list is shown again, and when
   * the store goes (the key locks: this screen unmounts).
   */
  const [opened, setOpened] = useState<Record<string, Opened>>({});
  const wipe = (o: Record<string, Opened>) => { for (const x of Object.values(o)) x.key.fill(0); };
  useEffect(() => {
    if (page.kind === 'list') setOpened(o => { wipe(o); return {}; });
  }, [page.kind]);
  const openedRef = React.useRef(opened);
  openedRef.current = opened;
  useEffect(() => () => wipe(openedRef.current), []);
  const [search, setSearch] = useState('');
  /* the list's filters: one kind, one folder (spec UI: "search, folders, kind filter") */
  const [kindFilter, setKindFilter] = useState<KindFilter>('All');
  const [folderFilter, setFolderFilter] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  /* a long-pressed row's shortcuts (RowActions): copy and type without opening the entry */
  const [rowFor, setRowFor] = useState<Entry | null>(null);
  const bt = useSharedBtKeyboard();
  const canType = bt.state === 'connected' && bt.forwarding;
  /* Back: an edit to its entry, a new entry's form (or a phrase) to the Add page, the rest to the list */
  const back = useCallback(
    () =>
      setPage(p =>
        (p.kind === 'edit' && p.id) || p.kind === 'to-slot' ? {kind: 'entry', id: p.id!} : (p.kind === 'edit' || p.kind === 'phrase' || p.kind === 'derive-new') ? {kind: 'add', id: null} : {kind: 'list'},
      ),
    [],
  );
  useEffect(() => {
    if (page.kind === 'list') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      back();
      return true;
    });
    return () => sub.remove();
  }, [page, back]);

  /* an action's failure, said - a press refused or timed out included */
  const act = useCallback((fn: () => void | Promise<void>) => {
    Promise.resolve(fn()).catch(err => Alert.alert('Passwords', String(err?.message ?? err)));
  }, []);

  /* this entry opened with its press (one per visit); its page then shows and edits its secrets */
  const openOne = async (e: Entry) => {
    const r = await openEntry(e, await keyFor(), identity);
    setOpened(o => ({...o, [e.id]: {entry: r.entry, key: r.key}}));
  };

  /*
   * Seal and save: the entry's secrets under its press (innerKeys.ts) - with the key of this visit's
   * open when there is one, else one press. An entry with no secret at all (a login with only its
   * username) needs no seal and no press.
   */
  const saveEntry = async (input: any, was?: Opened) => {
    if (!innerLib.hasPlainSecret(input)) return manager.put(input);
    const {entry, key} = await sealEntry(input, await keyFor(), identity, was?.key ?? null);
    const saved = await manager.put(entry);
    setOpened(o => {
      if (o[saved.id] && o[saved.id].key !== key) o[saved.id].key.fill(0);
      return {...o, [saved.id]: {entry: {...stripInner(input), id: saved.id}, key}};
    });
    return saved;
  };

  /*
   * The shortcuts a row offers: only labels. Every secret is sealed, so a password, a code or a
   * note is copied or typed from its entry, after its press.
   */
  const rowActions = (e: Entry | null): RowAction[] => {
    if (!e) return [];
    const out: RowAction[] = [];
    if (e.username) out.push({title: 'Copy username', primary: true, onPress: () => act(() => copy(e.username, 'Username'))});
    if (canType && e.username) out.push({title: 'Type username + Tab', onPress: () => act(() => bt.typeSecret(e.username!, {then: 'tab'}))});
    return out;
  };

  /* read on every draw, not memoised: the Autofill sheet adds entries to this same store */
  void rev;
  const entries = manager.locked ? [] : (manager.list() as Entry[]);
  const refused = manager.locked ? 0 : manager.refused().length;

  if (page.kind !== 'list') {
    const stored = page.id ? (manager.get(page.id) as Entry | null) : null;
    /* a sealed entry, once opened, is shown and edited with its secrets */
    const was = page.id ? opened[page.id] : undefined;
    const entry = was ? was.entry : stored;
    /* still sealed: its page (and its editor - saving it unopened would drop its secrets) asks for its press first */
    const shut = !!stored?.inner && !was && (page.kind === 'entry' || page.kind === 'edit' || page.kind === 'to-slot');
    const title =
      page.kind === 'add' ? 'Add' : page.kind === 'to-slot' ? 'Put on a key slot' : page.kind === 'derive-new' ? 'New derived password' : page.kind === 'phrase' ? 'New wallet phrase' : page.kind === 'edit' ? (entry ? `Edit ${entry.title}` : 'New entry') : entry?.title ?? '';
    return (
      <View style={styles.root}>
        <View style={styles.row}>
          <Btn title="‹ Back" onPress={back} />
          <View style={styles.titleBox}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
          </View>
        </View>
        {shut && entry ? (
          <SealedEntry entry={entry} act={act} onOpen={() => openOne(entry)} />
        ) : page.kind === 'phrase' ? (
          <NewPhrase
            manager={manager}
            phraseKey={phraseKey}
            act={act}
            onSaved={id => {
              setRev(n => n + 1);
              setPage({kind: 'entry', id});
            }}
          />
        ) : page.kind === 'to-slot' && entry?.totp ? (
          /* PUT ON A KEY SLOT (spec "Using a code"): the key types the code itself from then on */
          <ScrollView contentContainerStyle={styles.pad}>
            <Text style={styles.body}>
              Pick the slot for "{entry.title}". Its setup key is written into that slot's TOTP; the key then types the code from the
              slot itself. The slot's own code, if it has one, is replaced.
            </Text>
            <SlotsScreen
              panel
              onOpen={slot =>
                Alert.alert('Write the code to this slot?', `Slot ${slot.id}${slot.label ? ` ("${slot.label}")` : ''} gets this setup key. Its own code, if any, is replaced.`, [
                  {text: 'Cancel', style: 'cancel'},
                  {
                    text: 'Write',
                    onPress: () =>
                      act(async () => {
                        await writeSlot(slot.id, entry.totp.secret);
                        Alert.alert('Written', `Slot ${slot.id} has the code.`);
                        setPage({kind: 'entry', id: entry.id});
                      }),
                  },
                ])
              }
            />
          </ScrollView>
        ) : page.kind === 'derive-new' ? (
          <NewDerived
            manager={manager}
            deriveKey={phraseKey}
            act={act}
            onSaved={id => {
              setRev(n => n + 1);
              setPage({kind: 'entry', id});
            }}
          />
        ) : page.kind === 'add' ? (
          <AddPage
            first={entries.length === 0}
            keyName={keyName}
            onPick={next =>
              setPage(next === 'phrase' ? {kind: 'phrase', id: null} : next === 'derived' ? {kind: 'derive-new', id: null} : {kind: 'edit', id: null, newKind: next})
            }
          />
        ) : page.kind === 'edit' ? (
          <EntryEditor
            newKind={page.newKind}
            /* never a phrase: a phrase entry has no Edit (its recipe is the entry) */
            entry={entry as (Entry & {kind: 'login' | 'note' | 'card' | 'totp'}) | null}
            onSave={input =>
              act(async () => {
                /* a changed password goes to the history, inside the seal (the last five) */
                const base: any = was?.entry;
                let history = base?.history ?? [];
                if (base?.password && input.password !== base.password) {
                  history = [{password: base.password, changedAt: new Date().toISOString()}, ...history].slice(0, 5);
                }
                const saved = await saveEntry({...input, ...(history.length ? {history} : {})}, was);
                setRev(n => n + 1);
                setPage({kind: 'entry', id: saved.id});
              })
            }
            onDelete={
              entry
                ? () =>
                    Alert.alert('Delete this entry?', `"${entry.title}" is removed from this store. It cannot be brought back.`, [
                      {text: 'Cancel', style: 'cancel'},
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () =>
                          act(async () => {
                            await manager.remove(entry.id);
                            setRev(n => n + 1);
                            setPage({kind: 'list'});
                          }),
                      },
                    ])
                : undefined
            }
          />
        ) : entry?.kind === 'derived' ? (
          <DerivedEntry entry={entry} deriveKey={phraseKey} act={act} copy={copy} />
        ) : entry?.kind === 'mnemonic' ? (
          <PhraseEntry entry={entry} phraseKey={phraseKey} act={act} />
        ) : entry ? (
          <EntryView
            entry={entry}
            act={act}
            onEdit={() => setPage({kind: 'edit', id: entry.id})}
            /* HOTP's counter is a secret's part: sealed again with this visit's key, no second press */
            onCounter={async next => {
              await saveEntry({...entry, totp: {...entry.totp, counter: next}}, was);
              setRev(n => n + 1);
            }}
            onToSlot={() => setPage({kind: 'to-slot', id: entry.id})}
          />
        ) : (
          <Text style={[styles.body, styles.pad]}>This entry is gone.</Text>
        )}
      </View>
    );
  }

  const q = search.trim().toLowerCase();
  const folders = [...new Set(entries.map(e => e.folder).filter((f): f is string => !!f))].sort((a, b) => a.localeCompare(b));
  const shown = entries.filter(
    e =>
      (kindFilter === 'All' || KIND_OF_FILTER[kindFilter].includes(e.kind)) &&
      (folderFilter === null || e.folder === folderFilter) &&
      (!q || [e.title, e.username, e.folder, ...(e.urls ?? []), ...(e.tags ?? [])].some(s => s && s.toLowerCase().includes(q))),
  );
  const filtered = !!q || kindFilter !== 'All' || folderFilter !== null;
  const items: EdgeListItem[] = [];
  if (refused) {
    items.push({
      key: 'refused',
      kind: 'row',
      tone: 'alarm',
      title: `${refused} record${refused === 1 ? '' : 's'} here did not open`,
      subtitle: 'They are not shown. A record that does not open with this key, or that was moved onto another record, is refused - never shown as an entry.',
    });
  }
  for (const kind of ['login', 'derived', 'note', 'card', 'totp', 'mnemonic'] as const) {
    const of = shown.filter(e => e.kind === kind);
    if (!of.length) continue;
    items.push({key: `s-${kind}`, kind: 'section', title: KIND_TITLE[kind], right: String(of.length)});
    for (const e of of) {
      /* an authenticator's code shows on its entry, after its press: its setup key is sealed */
      items.push({
        key: e.id,
        kind: 'row',
        title: e.title,
        subtitle:
          e.kind === 'mnemonic'
            ? `${e.recipe?.out === 'bip39-12' ? 12 : 24} words, from the key`
            : e.kind === 'totp'
              ? e.urls?.[0] ? hostOf(e.urls[0]) : 'authenticator'
              : e.kind === 'derived'
                ? e.username || 'made from the key'
                : e.username || (e.urls?.[0] ? hostOf(e.urls[0]) : undefined),
        onPress: () => act(() => setPage({kind: 'entry', id: e.id})),
        onLongPress: () => setRowFor(e),
      });
    }
  }

  /*
   * MOVING PASSWORDS. The export is the list sealed under the store key, each entry's secrets still
   * in their own seal - so the file opens only with this key or one from its backup; an import adds
   * what is not here and counts what it skips.
   */
  const move = (kind: 'export' | 'save' | 'import') =>
    act(async () => {
      /* the sealed copy into a folder the person picks (spec: "Save to a folder through Android's file picker") */
      if (kind === 'save') {
        const stamp = new Date().toISOString().slice(0, 10);
        const r = await NativeShare.saveFile(`onlykey-passwords-${stamp}.json`, manager.exportJSON(), 'application/json');
        if (r.saved) Alert.alert('Saved', `Sealed copy saved as ${r.name || 'the chosen file'}. It opens only with this key or one restored from its backup.`);
        return;
      }
      if (kind === 'export') {
        const stamp = new Date().toISOString().slice(0, 10);
        await NativeShare.shareFile(`onlykey-passwords-${stamp}.json`, manager.exportJSON(), 'application/json', 'Passwords (sealed)');
        return;
      }
      const picked = await NativeShare.pickTextFile('application/json');
      if (!picked.picked) return;
      const r = await manager.importJSON(picked.content);
      setRev(n => n + 1);
      Alert.alert('Import', `${r.imported} added, ${r.skipped} already here, ${r.unreadable} could not be read.`);
    });
  if (filtered && !shown.length) items.push({key: 'nomatch', kind: 'row', tone: 'dim', title: 'Nothing matches'});
  if (!q && !entries.length) items.push({key: 'none', kind: 'row', tone: 'dim', title: 'No passwords yet', subtitle: '+ Add makes the first one.'});
  /* the panels below belong to the whole store, not to a filtered view */
  if (!filtered) {
    /* the phone's only: Android Autofill */
    if (shell === 'android') {
      items.push({key: 's-autofill', kind: 'section', title: 'Autofill'});
      items.push({key: 'autofill', kind: 'node', render: () => <AutofillCard />});
    }
    items.push({key: 's-move', kind: 'section', title: 'Move passwords'});
    items.push({
      key: 'move',
      kind: 'node',
      render: () => (
        <View>
          <Text style={styles.dim}>
            A sealed export opens only with this key or a key restored from its backup.
          </Text>
          <View style={styles.buttons}>
            <Btn title="Save to a folder (sealed)" onPress={() => move('save')} />
            <Btn title="Share (sealed)" onPress={() => move('export')} />
            <Btn title="Import (sealed)" onPress={() => move('import')} />
            {/* Import old vault: hidden - no legacy support yet (Brad, 2026-10-11); lib legacy.js stays */}
          </View>
        </View>
      ),
    });
  }

  return (
    <View style={styles.root}>
      <View style={styles.bar}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={`Search ${entries.length} on the ${keyName}`}
          placeholderTextColor={theme.textDim}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.input, styles.search]}
        />
        <Btn title="+ Add" tone="primary" onPress={() => act(() => setPage({kind: 'add', id: null}))} />
        <Btn title="Lock" onPress={lockNow} />
      </View>
      <View style={styles.filters}>
        <Segmented options={KIND_FILTERS} value={kindFilter} onChange={setKindFilter} />
        {folders.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={SHOW_SCROLLBARS} contentContainerStyle={styles.chips}>
            <Btn title="All folders" tone={folderFilter === null ? 'primary' : 'default'} onPress={() => setFolderFilter(null)} />
            {folders.map(f => (
              <Btn key={f} title={f} tone={folderFilter === f ? 'primary' : 'default'} onPress={() => setFolderFilter(folderFilter === f ? null : f)} />
            ))}
          </ScrollView>
        ) : null}
      </View>
      <EdgeList items={items} empty="Nothing matches." />
      <RowActions title={rowFor ? rowFor.title : null} actions={rowActions(rowFor)} onClose={() => setRowFor(null)} />
    </View>
  );
}

/*
 * + ADD: one button per kind (Brad, 2026-10-11: "the +add button need to go into a view to a list
 * of button, like + Wallet Phrase"). Authenticator: TOTP, in 0.0.7 (Brad, same day).
 */
const ADD_KINDS: {kind: NewKind | 'phrase' | 'derived'; title: string; what: string}[] = [
  {kind: 'login', title: '+ Login', what: 'A username and password for a site or an app.'},
  {kind: 'derived', title: '+ Derived password', what: 'A password made from this OnlyKey and a name - nothing of it is stored; the same name gives it again.'},
  {kind: 'note', title: '+ Note', what: 'Text kept sealed: a code, an answer, anything.'},
  {kind: 'card', title: '+ Card', what: 'A card number or a PIN.'},
  {kind: 'totp', title: '+ Authenticator', what: 'The 6-digit code for two-step sign-in (GitHub and others), from its setup key or QR link.'},
  {kind: 'phrase', title: '+ Wallet phrase', what: 'A BIP39 phrase made from this OnlyKey and a name - nothing of it is stored.'},
];

function AddPage({first, keyName, onPick}: {first: boolean; keyName: string; onPick: (kind: NewKind | 'phrase' | 'derived') => void}) {
  return (
    <ScrollView contentContainerStyle={styles.pad}>
      {/*
        * Before the first entry (spec Security: "OnlyKey lost with no backup - Data lost. By design;
        * the backup section says so in the UI before the first entry is saved"). The app cannot
        * tell whether the key has a backup key set - only a backup attempt says so - so it says it
        * to everyone, once the store is empty.
        */}
      {first ? (
        <Text style={[styles.dim, styles.firstNote]}>
          Everything saved here opens only with the {keyName}, or with a key restored from its backup. Without a backup, losing the key loses these. Make one in Settings › Backup/Restore.
        </Text>
      ) : null}
      {ADD_KINDS.map(k => (
        <View key={k.kind} style={styles.addRow}>
          <Btn title={k.title} tone="primary" onPress={() => onPick(k.kind)} />
          <Text style={[styles.dim, styles.addWhat]}>{k.what}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

/*
 * AN ENTRY NOT OPENED YET: its labels show (they are the store's), its secrets wait for a press of
 * the key (innerKeys.ts) - one per visit.
 */
function SealedEntry({entry, act, onOpen}: {entry: Entry; act: (fn: () => void | Promise<void>) => void; onOpen: () => Promise<void>}) {
  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <Section title="Sealed to the key">
        {entry.username ? <KeyValue label="Username" value={entry.username} /> : null}
        {entry.urls?.length ? <KeyValue label={entry.urls.length > 1 ? 'Sites' : 'Site'} value={entry.urls.join('\n')} /> : null}
        <Text style={styles.body}>Its password, notes and code open with a press of the key, each time.</Text>
        <View style={styles.buttons}>
          <Btn title="Open with OnlyKey" tone="primary" onPress={() => act(onOpen)} />
        </View>
      </Section>
    </ScrollView>
  );
}

function EntryView({
  entry,
  act,
  onEdit,
  onCounter,
  onToSlot,
}: {
  entry: Entry;
  act: (fn: () => void | Promise<void>) => void;
  onEdit: () => void;
  onCounter?: (next: number) => Promise<void>;
  onToSlot?: () => void;
}) {
  const [show, setShow] = useState(false);
  /* Type: the phone as the computer's Bluetooth keyboard, US layout (useBtKeyboard typeSecret) */
  const bt = useSharedBtKeyboard();
  const canType = bt.state === 'connected' && bt.forwarding;
  const type = (text: string | undefined, then: 'tab' | 'enter' | null) =>
    act(async () => {
      if (text) await bt.typeSecret(text, {then});
    });
  /* an authenticator entry: its code, and Edit */
  if (entry.kind === 'totp') {
    return (
      <ScrollView contentContainerStyle={styles.pad}>
        <TotpCode totp={entry.totp} act={act} copy={copy} title={entry.title} onCounter={onCounter} onToSlot={onToSlot} />
        {entry.notes ? <Section title="Notes"><KeyValue label="Notes" value={entry.notes} /></Section> : null}
        <View style={styles.buttons}>
          <Btn title="Edit" onPress={() => act(onEdit)} />
        </View>
      </ScrollView>
    );
  }
  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <Section title={KIND_TITLE[entry.kind].replace(/s$/, '')}>
        {entry.username ? <KeyValue label="Username" value={entry.username} /> : null}
        {entry.password ? <KeyValue label="Password" value={show ? entry.password : '••••••••••'} /> : null}
        {entry.urls?.length ? <KeyValue label={entry.urls.length > 1 ? 'Sites' : 'Site'} value={entry.urls.join('\n')} /> : null}
        {entry.notes ? <KeyValue label="Notes" value={entry.notes} /> : null}
        {entry.password || entry.notes || entry.totp ? <Text style={styles.dim}>Opened with a press for this visit.</Text> : null}
        {entry.androidApps?.length ? <KeyValue label="Apps" value={entry.androidApps.map(a => a.package).join('\n')} /> : null}
        {entry.folder ? <KeyValue label="Folder" value={entry.folder} /> : null}
        {entry.tags?.length ? <KeyValue label="Tags" value={entry.tags.join(', ')} /> : null}
        <View style={styles.buttons}>
          {entry.password ? <Btn title="Copy password" tone="primary" onPress={() => act(() => copy(entry.password, 'Password'))} /> : null}
          {entry.username ? <Btn title="Copy username" onPress={() => act(() => copy(entry.username, 'Username'))} /> : null}
          {entry.password ? <Btn title={show ? 'Hide' : 'Show'} onPress={() => act(() => setShow(s => !s))} /> : null}
          <Btn title="Edit" onPress={() => act(onEdit)} />
        </View>
      </Section>
      {/* the phone's only: it types as a Bluetooth keyboard */}
      {shell === 'android' && entry.kind === 'login' && (entry.username || entry.password) ? (
        <Section title="Type on the computer">
          {canType ? (
            <>
              <Text style={styles.dim}>Typed into whatever has focus on {bt.host || 'the connected computer'}. US keyboard layout.</Text>
              <View style={styles.buttons}>
                {entry.username ? <Btn title="Type username + Tab" onPress={() => type(entry.username, 'tab')} /> : null}
                {entry.password ? <Btn title="Type password" tone="primary" onPress={() => type(entry.password, null)} /> : null}
                {entry.password ? <Btn title="Type password + Enter" onPress={() => type(entry.password, 'enter')} /> : null}
              </View>
            </>
          ) : (
            <Text style={styles.dim}>
              {bt.state === 'connected' ? 'Typing to the computer is switched off (the keyboard IO switch).' : 'Connect a computer on the Bluetooth tab to type here.'}
            </Text>
          )}
        </Section>
      ) : null}
      {/* a login's own authenticator code (GitHub: the password, then this) */}
      {entry.totp ? <TotpCode totp={entry.totp} act={act} copy={copy} onCounter={onCounter} onToSlot={onToSlot} /> : null}
      {entry.history?.length ? (
        <Section title="Earlier passwords">
          {entry.history.map((h, i) => (
            <View key={i} style={styles.history}>
              <Text style={styles.body}>{show ? h.password : '••••••••••'}</Text>
              <Text style={styles.dim}>until {h.changedAt.slice(0, 10)}</Text>
              <Btn title="Copy" onPress={() => act(() => copy(h.password, 'Earlier password'))} />
            </View>
          ))}
        </Section>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  firstNote: {color: theme.warn, marginBottom: 12},
  root: {flex: 1},
  incoming: {flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: theme.accent},
  incomingText: {flex: 1, color: theme.text, fontSize: 13},
  pad: {padding: 16},
  row: {flexDirection: 'row', alignItems: 'stretch', paddingHorizontal: 16, paddingTop: 16},
  titleBox: {marginTop: 10, marginLeft: 16, justifyContent: 'center', flex: 1},
  title: {color: theme.text, fontSize: 18, fontWeight: '700'},
  bar: {flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 8},
  search: {flex: 1},
  input: {
    marginTop: 8,
    color: theme.text,
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.inputBg,
  },
  body: {color: theme.text, fontSize: 14, lineHeight: 20},
  dim: {color: theme.textDim, fontSize: 12},
  store: {color: theme.textDim, fontSize: 12, fontFamily: theme.mono, marginTop: 8},
  buttons: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  history: {flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap'},
  addRow: {flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4},
  session: {paddingHorizontal: 16, paddingBottom: 6},
  filters: {paddingHorizontal: 16, paddingBottom: 6, gap: 4},
  chips: {gap: 8},
  addWhat: {flex: 1},
});

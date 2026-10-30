/*
 * THE CORE TABS AS PLUGINS (PROPOSAL-rectify-ok-edge.md R0; Brad, 2026-10-30: "i need ok-edge to be rectified so we dont
 * keep duplicating logic, and consolidate logic into proper areas"). MainApp used to name every tab itself - a TABS list,
 * five filter lists (hidden, debug-only, Android-only, not-web, testing) and a render branch per tab, all inside one
 * 1900-line function. Each tab now registers with the app's `tabs` registry (src/plugins/tabs.ts) as Passwords and Guest
 * Book always did: its place in the drawer, when it shows, and how it draws from the TabContext. Which tabs a platform
 * has at all is its feature list, a platform file (list.android.ts / list.web.ts / list.desktop.ts) - no shell checks.
 *
 * The renders are the ones MainApp had, moved, not rewritten: the screens take what they took. Navigation that belongs
 * to a feature (a tapped Edge alarm, the request sheet's budget card, "Set up in Key Chain") is that feature's watch now.
 */
import React, {useEffect, useState} from 'react';
import {AppState, Text} from 'react-native';
import type {AppTab, AppWatch, TabContext} from '../plugins/types';
import type {TabsService} from '../plugins/tabs';
import {WANTED, PRE} from '../ui/configModeNotes';
import {theme} from '../ui/theme';
import {hasSoftKeyPlugin} from '../buildInfo';
import {useSharedBtKeyboard} from '../hooks/BtKeyboardContext';
import {onOpenBudget} from '../edgeNav';
import {onOpenKeyChainWizard} from '../keyChainNav';
import {BT_SEQ_BASE, takeOpenedAlarm} from '../edgeAlerts';
import {KeyScreen} from '../screens/KeyScreen';
import {SlotsScreen} from '../screens/SlotsScreen';
import {SlotEditorScreen} from '../screens/SlotEditorScreen';
import {KeysScreen} from '../screens/KeysScreen';
import {KeyChainScreen} from '../screens/KeyChainScreen';
import {BackupScreen} from '../screens/BackupScreen';
import {BluetoothScreen} from '../screens/BluetoothScreen';
import {SyncScreen} from '../screens/SyncScreen';
import {CryptoScreen} from '../screens/CryptoScreen';
import {EncryptDecryptScreen} from '../screens/EncryptDecryptScreen';
import {EncryptDecryptTabScreen} from '../screens/EncryptDecryptTabScreen';
import {SettingsScreen, type SettingsPage} from '../screens/SettingsScreen';
import {SetupTabScreen} from '../screens/SetupTabScreen';
import {FirmwareTabScreen} from '../screens/FirmwareTabScreen';
import {PreferencesScreen} from '../screens/PreferencesScreen';
import {PasskeysScreen} from '../screens/PasskeysScreen';
import {LogScreen} from '../screens/LogScreen';
import {AdvancedScreen} from '../screens/AdvancedScreen';
import {TestingScreen} from '../screens/TestingScreen';
import {EdgeScreen} from '../screens/EdgeScreen';
import {ActivityScreen} from '../screens/ActivityScreen';
import {EdgeRequestSheet} from '../ui/EdgeRequestSheet';
import {HostChallengeSheet} from '../ui/HostChallengeSheet';
import {KeyBusySheet} from '../ui/KeyBusySheet';
import {PressSheet} from '../ui/PressSheet';
import {SilentUseSheet} from '../ui/SilentUseSheet';
import {UpdateSheet} from '../ui/UpdateSheet';

type Register = (err: Error | null, services: Record<string, unknown>) => void;

/*
 * One plugin per tab: it consumes the registry and adds its tab (and its watch). Rectify wants each plugin to provide a
 * service of its own name; a tab's is `tab:<name>`, holding nothing.
 */
export function tabPlugin(tab: AppTab, watch?: AppWatch) {
  const setup = (imports: {tabs: TabsService}, register: Register) => {
    imports.tabs.add(tab, watch);
    register(null, {[`tab:${tab.name}`]: {}});
  };
  setup.consumes = ['tabs'];
  setup.provides = [`tab:${tab.name}`];
  return setup;
}

/*
 * 'This Key', not 'Key' and no longer 'Soft Key'.
 *
 * Two things a tab could mean by "key": the DEVICE, and the private keys loaded into it. One letter between 'Key' and
 * 'Keys' is not a distinction anyone can hold onto, which is why this tab has never just been called 'Key'. It was
 * 'Soft Key' while that was the only device there was. It can now be either - the same screen reads whichever key is
 * selected - so naming it for one of them would be wrong half the time. The screen itself says which.
 *
 * THE ORDER FOLLOWS THE ORIGINAL APPS (owner, 2026-09-29: "follow the user feel of the original apps, starting with the
 * tab layout and where things are").
 * - This Key stays first: the landing page, ok-rn's own.
 * - Then the desktop App's menu in its order - Setup (here "PIN Setup": it holds only the PIN changes; the backup
 *   passphrase sits on Backup/Restore beside the restore that uses it), Slots, Keys, Backup/Restore, Firmware,
 *   Preferences, Advanced (OnlyKey-App app/app.html:36-43) - with the web app's two, Encrypt and Decrypt
 *   (apps.onlykey.io mode-tabs.js), after Setup. The desktop's Tools tab is left out: it only links to the web app's
 *   encrypt/decrypt pages, which ok-rn has as tabs of its own.
 * - ok-rn's own tabs where the owner placed them: Key Chain right before Keys, Passkeys after Keys, Bluetooth above
 *   Advanced, Log last.
 * - Preferences holds what can be changed back, Advanced what cannot (the library's `oneWay` flag decides). The desktop
 *   keeps both in its Preferences; this is the one deliberate difference.
 *
 * EDGE SECOND, SETTINGS LAST (Brad, 2026-10-11: "Settings Tab,, should be at the Bottom, in the list of tabs,, and Edge
 * should be 2nd"); the rest in the order the drawer always had. Plugin tabs place themselves `after` one of these.
 */
const ORDER = {
  'This Key': 10, Edge: 20, 'PIN Setup': 30, 'Encrypt/Decrypt': 40, Encrypt: 41, Decrypt: 42, Slots: 50, 'Key Chain': 60,
  Keys: 70, Passkeys: 80, 'Backup/Restore': 90, Firmware: 100, Preferences: 110, Bluetooth: 120, Sync: 130, Activity: 140,
  Advanced: 150, Log: 160, 'In-Development': 900, Testing: 910, Settings: 1000,
} as const;

const want = (ctx: TabContext) => ctx.wantConfigMode;

/* PIN Setup, Preferences, Backup/Restore, Firmware, Advanced: drawn by Settings' sub views and by their own (hidden) tabs */
function settingsPage(ctx: TabContext, page: SettingsPage) {
  const {emu, keys, configMode, blockScreenshots} = ctx;
  return page === 'PIN Setup' ? (
    <SetupTabScreen emu={emu} blockScreenshots={blockScreenshots} configMode={configMode} onWantConfigMode={want(ctx)} />
  ) : page === 'Preferences' ? (
    /* The PIN changes are on PIN Setup. */
    <PreferencesScreen emu={emu} configMode={configMode} onWantConfigMode={want(ctx)} show={['prefs']} />
  ) : page === 'Backup/Restore' ? (
    /* The backup key is here, beside the restore that needs it. */
    <BackupScreen emu={emu} blockScreenshots={blockScreenshots} configMode={configMode} onWantConfigMode={want(ctx)} show={['capture', 'backupKey', 'restore']} />
  ) : page === 'Firmware' ? (
    <FirmwareTabScreen emu={keys.key} hardRunning={keys.hard.state === 'running'} configMode={configMode} onWantConfigMode={want(ctx)} />
  ) : (
    <AdvancedScreen emu={keys.key} hard={keys.hard} keys={keys} configMode={configMode} onWantConfigMode={want(ctx)} />
  );
}

/*
 * THIS KEY, with its slots (a panel under Buttons; a slot opens its editor here). `slots: false` where slots cannot be
 * read - they are vendor messages, which a web page cannot send (list.web.ts).
 */
type OpenSlot = {id: string; index: number; label: string | null};
function ThisKeyTab({ctx, slots}: {ctx: TabContext; slots: boolean}) {
  const [open, setOpen] = useState<OpenSlot | null>(null);
  return open ? (
    <SlotEditorScreen slot={open} emu={ctx.emu} onBack={() => setOpen(null)} blockScreenshots={ctx.blockScreenshots} />
  ) : (
    <KeyScreen emu={ctx.emu} keys={ctx.keys} configMode={ctx.configMode === PRE} onCheckConfig={ctx.checkConfig} checking={ctx.checking}
      slots={slots ? <SlotsScreen panel onOpen={setOpen} /> : undefined} />
  );
}
export const thisKey = ({slots}: {slots: boolean}) => tabPlugin({name: 'This Key', order: ORDER['This Key'], inLockedTesting: true, render: ctx => <ThisKeyTab ctx={ctx} slots={slots} />});

/* SLOTS (kept, not in the drawer: a panel on This Key now) */
function SlotsTab({ctx}: {ctx: TabContext}) {
  const [open, setOpen] = useState<OpenSlot | null>(null);
  /* FLAG_SECURE blanks adb screenshots as well as a bystander photo, so testing mode turns it off */
  return open ? <SlotEditorScreen slot={open} emu={ctx.emu} onBack={() => setOpen(null)} blockScreenshots={ctx.blockScreenshots} /> : <SlotsScreen onOpen={setOpen} />;
}
export const slots = tabPlugin({name: 'Slots', order: ORDER.Slots, hidden: true, render: ctx => <SlotsTab ctx={ctx} />});

/*
 * EDGE. On the phone and the web app: whenever the soft key carries the Edge firmware plugin (OKEMU_PLUGINS=edge), else
 * in testing mode (the FAKE key). On the desktop always - it hosts the hard key's Edge (useEdge), whatever its bundled
 * soft key has (list.desktop.ts: `always`).
 *
 * Its navigation is its own: a tapped Edge alarm opens it on that link (on launch and on every return to the app), a
 * cli pair alarm opens Sync, and the request sheet's budget card opens it on that budget (edgeNav.ts).
 */
let edgeNav: {focus: number | null; budget: number | null} = {focus: null, budget: null};
const edgeNavSeen = new Set<() => void>();
const setEdgeNav = (next: Partial<typeof edgeNav>) => { edgeNav = {...edgeNav, ...next}; for (const f of edgeNavSeen) f(); };
function EdgeTab({ctx}: {ctx: TabContext}) {
  const [, redraw] = useState(0);
  useEffect(() => { const f = () => redraw(n => n + 1); edgeNavSeen.add(f); return () => { edgeNavSeen.delete(f); }; }, []);
  return (
    <EdgeScreen testingMode={ctx.testing} focusSeq={edgeNav.focus} onFocused={() => setEdgeNav({focus: null})}
      openGrantId={edgeNav.budget} onBudgetOpened={() => setEdgeNav({budget: null})} />
  );
}
/* an agent's budget request (Edge step 2), over whatever tab is open - where this device hosts an Edge */
const edgeWatch = (always: boolean): AppWatch => function EdgeWatch({openTab}) {
  useEffect(() => onOpenBudget(id => { openTab('Edge'); setEdgeNav({budget: id}); }), [openTab]);
  useEffect(() => {
    const look = () => {
      const s = takeOpenedAlarm();
      if (s !== null && s >= BT_SEQ_BASE) openTab('Sync'); /* Part T: a cli pair alarm - the paired devices are on Sync */
      else if (s !== null) { openTab('Edge'); setEdgeNav({focus: s}); }
    };
    look();
    const sub = AppState.addEventListener('change', st => { if (st === 'active') look(); });
    return () => sub.remove();
  }, [openTab]);
  return always || hasSoftKeyPlugin('edge') ? <EdgeRequestSheet /> : null;
};
export const edge = ({always}: {always: boolean}) => tabPlugin({
  name: 'Edge', order: ORDER.Edge,
  when: always ? undefined : s => s.testing || hasSoftKeyPlugin('edge'),
  render: ctx => <EdgeTab ctx={ctx} />,
}, edgeWatch(always));

/* KEY CHAIN, and another screen's "Set up in Key Chain": this tab, its Wizard already started (keyChainNav.ts) */
const KeyChainWatch: AppWatch = ({openTab}) => {
  useEffect(() => onOpenKeyChainWizard(() => openTab('Key Chain')), [openTab]);
  return null;
};
export const keyChain = tabPlugin({
  name: 'Key Chain', order: ORDER['Key Chain'],
  render: ctx => <KeyChainScreen emu={ctx.emu} configMode={ctx.configMode} onWantConfigMode={want(ctx)} blockScreenshots={ctx.blockScreenshots} />,
}, KeyChainWatch);

/* KEYS (kept, not in the drawer: replaced by Key Chain) */
export const keys = tabPlugin({name: 'Keys', order: ORDER.Keys, hidden: true, render: ctx => <KeysScreen emu={ctx.emu} configMode={ctx.configMode} onWantConfigMode={want(ctx)} />});

/* ENCRYPT/DECRYPT, one tab with a switch at the top; Encrypt and Decrypt kept as they were, not in the drawer */
export const encryptDecrypt = tabPlugin({
  name: 'Encrypt/Decrypt', order: ORDER['Encrypt/Decrypt'],
  render: ctx => <EncryptDecryptTabScreen emu={ctx.emu} blockScreenshots={ctx.blockScreenshots} configMode={ctx.configMode} onWantConfigMode={want(ctx)} testing={ctx.testing} />,
});
const oneWay = (direction: 'encrypt' | 'decrypt') => (ctx: TabContext) => (
  <EncryptDecryptScreen key={direction} direction={direction} emu={ctx.emu} blockScreenshots={ctx.blockScreenshots} configMode={ctx.configMode} onWantConfigMode={want(ctx)} testing={ctx.testing} />
);
export const encrypt = tabPlugin({name: 'Encrypt', order: ORDER.Encrypt, hidden: true, render: oneWay('encrypt')});
export const decrypt = tabPlugin({name: 'Decrypt', order: ORDER.Decrypt, hidden: true, render: oneWay('decrypt')});

/* PASSKEYS: CTAPHID's credential management - not on the web app, which reaches a key over WebAuthn only (list.web.ts) */
export const passkeys = tabPlugin({name: 'Passkeys', order: ORDER.Passkeys, render: ctx => <PasskeysScreen emu={ctx.keys.key} configMode={ctx.configMode} />});

/* BLUETOOTH: the phone's only - it is the Bluetooth keyboard and authenticator (list.android.ts) */
export const bluetooth = tabPlugin({
  name: 'Bluetooth', order: ORDER.Bluetooth,
  render: ctx => ctx.bt ? (
    <BluetoothScreen fido={ctx.bt.fido} on={ctx.bt.on} setOn={ctx.bt.setOn} auto={ctx.bt.auto} canPress={ctx.emu.canPress === true} testing={ctx.testing} onOpenSync={() => ctx.openTab('Sync')} />
  ) : null,
});

/* SYNC: the identity, the server, the sync service and the paired devices (SyncScreen picks per shell's services) */
export const sync = tabPlugin({name: 'Sync', order: ORDER.Sync, render: ctx => <SyncScreen testing={ctx.testing} />});

/* ACTIVITY: the status icons' one tab (Brad, 2026-10-29) - reached by pressing any of them, so not in the menu */
/* the keyboard's state in words - read inside the phone's keyboard provider, as the bar's ⌨ is */
function KeyboardState() {
  return <Text style={{color: theme.text, fontSize: 13}}>{useSharedBtKeyboard().state}</Text>;
}
export const activity = tabPlugin({
  name: 'Activity', order: ORDER.Activity, hidden: true,
  render: ctx => <ActivityScreen bt={ctx.bt ? {on: ctx.bt.on, fido: ctx.bt.fido.state, keyboard: <KeyboardState />} : null} onOpen={ctx.openTab} />,
});

/*
 * SETTINGS, last in the drawer: PIN Setup, Preferences, Backup/Restore, Firmware and Advanced are its sub views (each
 * also kept as its own hidden tab). Not on the web app - each is vendor messages (list.web.ts).
 */
export const settings = tabPlugin({
  name: 'Settings', order: ORDER.Settings,
  render: ctx => <SettingsScreen render={page => settingsPage(ctx, page)} hidden={ctx.keys.hard.state === 'running' ? [] : ['Firmware']} />,
});
export const settingsPages = (['PIN Setup', 'Backup/Restore', 'Firmware', 'Preferences', 'Advanced'] as const).map(page =>
  tabPlugin({name: page, order: ORDER[page], hidden: true, render: ctx => settingsPage(ctx, page)}),
);

/*
 * IN-DEVELOPMENT: what the maintainer has not released - the vault, what it stored on this phone, derived secrets / the
 * password generator. His web app ships them only in its development build (plugins-devel.js), so here they are shown
 * only in testing mode, which is __DEV__-only.
 */
export const inDevelopment = tabPlugin({
  name: 'In-Development', order: ORDER['In-Development'], when: s => __DEV__ && s.testing,
  render: ctx => <CryptoScreen emu={ctx.emu} blockScreenshots={ctx.blockScreenshots} configMode={ctx.configMode} testing={ctx.testing} show={['derive', 'vault', 'stored']} />,
});

/*
 * LOG: for testing and debugging - not in a release build (Brad, 2026-10-11). Its buffers are named for the device, not
 * for the layer: both keys run firmware and both talk, and "USB bytes" is the byte-level USB panel.
 */
export const log = tabPlugin({
  name: 'Log', order: ORDER.Log, devOnly: true,
  render: ctx => ctx.dev ? <LogScreen blockScreenshots={ctx.blockScreenshots} buffers={ctx.dev.buffers} /> : null,
});

/*
 * TESTING: THE SOFT KEY, explicitly - not whichever is active. It starts and stops firmware, shows the storage files and
 * factory-resets: the emulator's controls; a hard key has none of them. Shown in testing mode, and with This Key while
 * the key is still locked.
 */
export const testing = tabPlugin({
  name: 'Testing', order: ORDER.Testing, when: s => __DEV__ && s.testing, inLockedTesting: true,
  render: ctx => ctx.dev ? (
    <TestingScreen configMode={ctx.configMode} setConfigMode={ctx.dev.setConfigMode} emu={ctx.keys.soft} hard={ctx.keys.hard} active={ctx.keys.key}
      backend={ctx.keys.backend} hid={ctx.dev.hid} usbEntries={ctx.dev.usb.entries} clearUsb={ctx.dev.usb.clear}
      /* the suite types a whole backup out on purpose, and a phone paired as a BLE keyboard would deliver it elsewhere */
      onE2EStart={ctx.dev.beforeE2E} />
  ) : null,
});

/*
 * THE KEY'S PROMPTS - no tab, over whatever tab is open. EVERY PRESS IS ASKED ON THE SHEET (Brad, 2026-10-10: "the
 * confirm button ... needs to be removed, so the sheet is the notifier with press button"; "blind presses is a
 * blocker"): a request that came over the API waits on the soft key, and PressSheet says what it is for and holds the
 * press; a passkey's presence is asked on the same sheet, with the site it names. Beside it: the code this app asks a
 * hard key for (hostChallenge.ts), the key working over WebAuthn with its progress (keyBusy.ts), a derive the soft key
 * answered unasked (SilentUseSheet), and a newer web app build pushed while logged in (webUpdate.ts).
 */
export function prompts() {
  const Prompts: AppWatch = ({keyWaiting, presence}) => (
    <>
      <HostChallengeSheet />
      <KeyBusySheet />
      <PressSheet waiting={keyWaiting} fido={presence} />
      <SilentUseSheet />
      <UpdateSheet />
    </>
  );
  const setup = (imports: {tabs: TabsService}, register: Register) => {
    imports.tabs.watch(Prompts);
    register(null, {prompts: {}});
  };
  setup.consumes = ['tabs'];
  setup.provides = ['prompts'];
  return setup;
}

/* every platform's tabs; its list file adds its own (list.android.ts / list.web.ts / list.desktop.ts) */
export const common = [prompts(), slots, keyChain, keys, encryptDecrypt, encrypt, decrypt, sync, activity, inDevelopment, log, testing];

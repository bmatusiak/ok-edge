import type {ReactNode} from 'react';
import type {Backend} from '../hooks/keySession';
import type {useKey} from '../hooks/useKey';
import type {FidoSession} from '../hooks/useFidoGatt';
import type {BtAuto} from '../hooks/useBtAuto';
import type {useUsbHid} from '../hooks/useUsbHid';
import type {ConfigState} from '../ui/configModeNotes';
import type {LogEntry} from '../hooks/useLog';
import type {LogBuffers} from '../screens/LogScreen';
import type {KeyWaiting} from '../transport/OkEmu';

/*
 * What an app plugin gets from the app, and what it gives back. The plugin never reaches into
 * MainApp.tsx: everything it may know comes in through these.
 *
 * EVERY TAB IS A PLUGIN'S (PROPOSAL-rectify-ok-edge.md R0, Brad, 2026-10-30: "consolidate logic into proper areas"):
 * the core tabs (This Key, Edge, Key Chain, Settings, ...) register here like Passwords and Guest Book, from
 * src/features; MainApp draws whatever the registry lists and names no tab itself.
 */

/** Each key's capabilities reading, as useOkEmu/useHardKey hold it (null before one). */
export type KeyCaps = {deviceVault?: boolean; touchFreeDerive?: string; [k: string]: unknown} | null | undefined;

export type Keys = ReturnType<typeof useKey>;

/** A log buffer the Log tab shows (useLog). */
export type LogBuffer = {entries: LogEntry[]; clear: () => void};

/** Given to a tab's render, each time the app draws it. */
export type TabContext = {
  /** the key chosen as active */
  backend: Backend;
  /** that key is running and unlocked */
  unlocked: boolean;
  caps: KeyCaps;
  /** FLAG_SECURE wanted (release builds): a screen showing secrets turns it on */
  blockScreenshots: boolean;
  /** both keys and the choice between them (useKey) */
  keys: Keys;
  /** the active key's session (keys.key) */
  emu: Keys['key'];
  /** config mode, as the app holds it (ui/configModeNotes) - a screen asks for it, the app runs the check */
  configMode: ConfigState;
  wantConfigMode: () => void;
  checkConfig: () => void;
  checking: boolean;
  /** testing mode on (debug builds only) */
  testing: boolean;
  /** bring a tab forward by its name */
  openTab: (name: string) => void;
  /** the phone's Bluetooth (the keyboard, the security key, its automations): null where there is none */
  bt: {on: boolean; setOn: (on: boolean) => void; fido: FidoSession; auto: BtAuto} | null;
  /** debug builds only: the log buffers, the raw USB session, config mode set directly (the Log and Testing tabs) */
  dev: {
    buffers: LogBuffers;
    hid: ReturnType<typeof useUsbHid>;
    usb: LogBuffer;
    setConfigMode: (s: ConfigState) => void;
    beforeE2E: () => void;
  } | null;
};

/** What decides whether a tab is in the drawer now. */
export type TabState = {
  /** testing mode on (debug builds only) */
  testing: boolean;
  /** testing mode with the key still locked: only the tabs marked inLockedTesting */
  testingLocked: boolean;
};

/** Given to a plugin's watch, mounted once with the app whether its tab is shown or not. */
export type WatchContext = {
  /** each key: running and unlocked */
  unlocked: Record<Backend, boolean>;
  /** bring a tab forward by its name (a link that belongs to a plugin's tab arrived) */
  openTab: (name: string) => void;
  /** what the active key waits for now - a press, a code (the press sheet asks for it) */
  keyWaiting: KeyWaiting | null;
  /** a site asking for a security key's presence (a passkey): the press sheet asks with the site it names */
  presence: {needed: boolean; canPress: boolean; confirm: () => void};
};

export type AppTab = {
  /** the drawer's label, unique among tabs */
  name: string;
  /** its place in the drawer (the core tabs number theirs); a plugin tab may name `after` instead */
  order?: number;
  /** shown after this tab of the app's (its place in the drawer); before Settings when neither is given */
  after?: string;
  /** kept but not in the drawer - reached from another tab (Settings' sub views) or by openTab */
  hidden?: boolean;
  /** debug builds only */
  devOnly?: boolean;
  /** in the drawer only while this holds (testing mode, a firmware plugin present) */
  when?: (s: TabState) => boolean;
  /** one of the tabs shown in testing mode while the key is still locked */
  inLockedTesting?: boolean;
  render: (ctx: TabContext) => ReactNode;
};

export type AppWatch = (props: WatchContext) => ReactNode;

/*
 * A CHANNEL: one way this device talks - Bluetooth, sync, the MCP, the desktop's pipe to the CLI (src/features/channels). Its icon
 * sits in the status bar (any of them opens Activity - Brad, 2026-10-29: "a single activity panel, containing all icons");
 * its card is on the Activity tab. A platform has the channels its list names.
 */
export type ChannelContext = {
  openTab: (name: string) => void;
  /** the phone's Bluetooth (TabContext.bt): null where there is none */
  bt: TabContext['bt'];
};
export type AppChannel = {
  name: string;
  /** its place among the icons and the cards */
  order: number;
  icon: (ctx: ChannelContext) => ReactNode;
  card: (ctx: ChannelContext) => ReactNode;
};

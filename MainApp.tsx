import React, {Fragment, useCallback, useEffect, useRef, useState} from 'react';
import {Alert, AppState, KeyboardAvoidingView, Pressable, StatusBar, StyleSheet, Text, View} from 'react-native';
import {currentNet, onNet, type Net} from './src/net';
import {clearIfScheduled} from './src/testnet';
import {resetEdgeStoreOnce} from './src/edgeV1';
import {errText} from './src/logSafe';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';

import {Btn, StatusPill} from './src/ui/components';
import {WANTED, OFF, PRE, ON, type ConfigState} from './src/ui/configModeNotes';
import OkEmu from './src/transport/OkEmu';
import {useKeyWaiting} from './src/hooks/useKeyWaiting';
import {useEdgeBackgroundSync} from './src/hooks/useEdgeBackgroundSync';
import {rememberTab, takeResumeTab} from './src/resumeTab';
import {Drawer} from './src/ui/Drawer';
import {Logo} from './src/ui/Logo';
import {ledColor, stateColor, theme} from './src/ui/theme';
import {IO_STEP_MS, ioPurple, nextShow, onIo, type IoChannel, type IoShow} from './src/btActivity';

import {useLog} from './src/hooks/useLog';
import {useKey} from './src/hooks/useKey';
import {KeyBackendProvider} from './src/hooks/KeyContext';
import {BtKeyboardProvider, useSharedBtKeyboard} from './src/hooks/BtKeyboardContext';
import {useBtAuto, type BtAuto} from './src/hooks/useBtAuto';
import {useUsbHid} from './src/hooks/useUsbHid';
import {useFidoGatt, type FidoSession} from './src/hooks/useFidoGatt';
import {getOnlyKey} from './src/onlykey';
import type {Backend} from './src/hooks/keySession';
import {useTestingMode} from './src/hooks/useTestingMode';
import {useKeyIdentity} from './src/keyIdentity';
import NativeShare from 'okedge-native/specs/NativeShare';
import {setTestingMode} from './src/debugGuard';
import {useWipeOnLock} from './src/hooks/useWipeOnLock';

import {SplashScreen} from './src/screens/SplashScreen';
import NativeOkEmu from 'okedge-native/specs/NativeOkEmu';

/*
 * THE SPLASH PLAYS ONCE PER PROCESS (Brad, 2026-10-04). Read when this module
 * loads: a JS reload loads it again in the same process, and the native flag
 * (specs/NativeOkEmu.ts) says the splash already played - so the app starts past
 * it, and whatever comes next (the soft key's "stopped" banner, an error) is seen
 * instead of a splash waiting forever for a firmware that cannot restart here.
 * An APK without the call just plays the splash, as before.
 */
const SPLASH_SEEN: boolean = (() => {
  try {
    return NativeOkEmu.splashDoneThisProcess?.() === true;
  } catch {
    return false;
  }
})();
import {LoginScreen} from './src/screens/LoginScreen';
import {PinScreen} from './src/screens/PinScreen';
import {SetupScreen} from './src/screens/SetupScreen';
import NativeFidoGatt from 'okedge-native/specs/NativeFidoGatt';
import {IdentityCheckScreen} from './src/screens/IdentityCheckScreen';
import {closeBucket} from './src/bucketStore';
import {endSession, keptSession} from './src/webSession';
import {logOut} from './src/logOut';
import {setIdleRunning} from './src/idleTimer';
import {IdleBar} from './src/ui/IdleBar';
import {BLUETOOTH_HERE, KEY_WAITS_FOR_LOGIN, SOFT_KEY_HERE, WEB_SESSION} from './src/platform';
import {registerWebCache, setLoggedIn, updateAtSplash} from './src/webUpdate';

/*
 * THE WEB APP'S UPDATE CHECK, ONCE A PAGE LOAD (src/webUpdate.ts): a newer build on the server reloads the page fresh
 * before anything else runs; offline, the app goes on from its cache. The worker is registered after it.
 */
const webChecked: Promise<void> = updateAtSplash().catch(() => undefined).then(() => registerWebCache());
import {armWebKey} from './src/hooks/useWebKey';
import {joinServerRoom, leaveServerRoom, onRoomState, roomState, type RoomState} from './src/serverRoom';
import {buildInfo} from './src/buildInfo';
import {pluginBanners, pluginChannels, pluginTabs, pluginWatches, shownTabs, usePluginsStarted} from './src/plugins';
import type {TabContext} from './src/plugins/types';
import {setFirmwareConsoleToLogcat} from './src/hooks/useOkEmu';
import {startKeyChainRecorder} from './src/keyChainRecorder';
import {startLinkStash} from './src/linkStash';

/**
 * Whether the screens that show secrets refuse to be captured.
 *
 * FOLLOWS THE BUILD, NOT THE SESSION. This used to be `!testing.enabled`, so a
 * DEBUG build blocked screenshots unless you had entered testing mode - which
 * made the ordinary development loop (change a screen, look at it) impossible
 * without bypassing the PIN first, and left the block untested in the only
 * build where it matters.
 *
 * `__DEV__` is false in a release bundle, so a shipped app always blocks and a
 * development build never does. Testing mode no longer comes into it: it is a
 * way to skip the door, not a statement about whether this screen holds
 * anything worth hiding.
 */
const BLOCK_SCREENSHOTS = !__DEV__;

/* a tab's name: every tab is a plugin's (src/plugins/tabs.ts, src/features/core.tsx) */
type Tab = string;

/** Splash until the device can answer, then a door, then the app. */
/* identity: after the unlock, before the app - which identity the key is (IdentityCheckScreen, Brad 2026-10-24) */
type Phase = 'splash' | 'login' | 'pin' | 'setup' | 'identity' | 'main';

/*
 * The provider has to sit ABOVE whatever reads insets, so the shell is its own
 * component - a hook inside App would be reading a provider that is its own
 * child, and would get zeros.
 */
/**
 * Hands the Bluetooth TARGET to the authenticator's IO gate.
 *
 * "Each door has a gate, and a device must be targeted." The target is the
 * keyboard's chosen host - one computer, approved for IO in both directions -
 * and the gates (WebAuthn, API) are useFidoGatt's. That hook is built in the
 * Shell, ABOVE BtKeyboardProvider, so it cannot read the target from the
 * context; this sits inside the provider, always mounted, and passes it
 * across. useFidoGatt then tells the radio (setIoPolicy) whenever the target
 * or either gate changes.
 *
 * Here, not on the Bluetooth tab: the tab unmounts whenever another is
 * shown, and the gate has to follow a target that is forgotten because its
 * bond went away while nobody was looking at the tab.
 */
function IoPolicySync({setTarget}: {setTarget: (address: string | null) => void}) {
  const {chosenHost} = useSharedBtKeyboard();
  useEffect(() => {
    setTarget(chosenHost);
  }, [chosenHost, setTarget]);
  return null;
}




export default function App() {
  /* every derive the soft key answers goes into the Key Chain list (plugins/key_chain) */
  useEffect(() => startKeyChainRecorder(), []);
  /* every Edge link the soft key writes, kept as it is written (linkStash: a swipe right after a login lost them) */
  useEffect(() => startLinkStash(), []);
  return (
    <SafeAreaProvider>
      <Shell />
    </SafeAreaProvider>
  );
}

function Shell() {
  // One log buffer per source so switching views does not interleave traffic.
  const usbLog = useLog();
  const fidoLog = useLog();
  const emuLog = useLog();

  /* The hard key talks too, and it is a different device saying it. */
  const hardLog = useLog();

  /*
   * Sessions are APP-SCOPED. Created inside a screen they died with it, so
   * switching views tore down every listener while the native thing carried on
   * running - the firmware kept going and the screen came back saying
   * "stopped", and the CTAP bridge stopped answering whenever you looked away.
   */
  /*
   * THE ACTIVE KEY, soft or hard, never both.
   *
   * useKey runs both underlying hooks - React does not allow a conditional
   * one - and hands over whichever the source setting selects. The soft key
   * therefore stays alive in the background while a hard one is in use, which
   * is what makes them comparable: attach a real key, look at it, unplug, and
   * the emulated one is still where it was rather than freshly booted.
   */
  /*
   * THE BRIDGE'S VIEW OF WHICH KEY IS ACTIVE, through refs.
   *
   * useFidoGatt has to be created here, above KeyBackendProvider, because
   * useKey() below needs fido.pending and the provider is fed from useKey's
   * own backend. That ordering is why the hook cannot read the key from
   * context - it did, silently got the default, and relayed every Bluetooth
   * WebAuthn ceremony to the soft key whatever was selected.
   *
   * A ref closes the loop without reordering anything: the getters are stable,
   * so nothing re-subscribes, and they read the CURRENT value at the moment a
   * browser actually asks.
   */
  const backendRef = useRef<Backend>('embedded');
  const getActiveKey = useCallback(() => getOnlyKey(backendRef.current), []);
  const getActiveBackend = useCallback(() => backendRef.current as string, []);
  /*
   * WHETHER THE ACTIVE KEY IS UNLOCKED, through a ref for the same reason as
   * the backend above: useKey() is built BELOW this line - it needs
   * fido.pending - so the value cannot be read here, only pointed at.
   */
  const unlockedRef = useRef(false);
  const isUnlocked = useCallback(() => unlockedRef.current, []);
  const fido = useFidoGatt({
    log: fidoLog.log,
    getKey: getActiveKey,
    getBackend: getActiveBackend,
    isUnlocked,
  });
  const keys = useKey({softLog: emuLog.log, hardLog: hardLog.log, fidoPending: fido.pending});


  backendRef.current = keys.backend;
  unlockedRef.current = keys.key.device === 'unlocked';
  const emu = keys.key;
  /*
   * TESTING MODE's Login (Brad, 2026-10-07: "a login button that sends the passcode
   * 1234561", hidden once unlocked): the dev keys' passcode, pressed on the soft key
   * as the keypad does, 200 ms apart (his keypad timing). Only in the testing bar,
   * which is __DEV__ - Metro folds it out of a release bundle, passcode and all.
   */
  /*
   * LOG IN, IN THIS RUN (Brad, 2026-10-29, the Pixel: "the login screen never re-appears, it auto tries to login" - on a
   * fresh process "i see splash, then login"). The app swiped away from Recents leaves its process alive with the soft
   * key still unlocked, and the next open started a new run of the app straight at the identity check - and the login
   * it began there could not be pressed. Every run of the app now waits at the login screen until the person logs in
   * in it (Log in, Login Bypass, Enter testing mode), whatever state the key is in; a run that only went to the
   * background and came back keeps its login.
   */
  const [loggedInThisRun, setLoggedInThisRun] = useState(false);
  const devLogin = useCallback(async () => {
    setLoggedInThisRun(true);
    for (const button of [1, 2, 3, 4, 5, 6, 1]) {
      keys.soft.press(button);
      await new Promise<void>(r => setTimeout(r, 200));
    }
  }, [keys.soft]);
  const devLoginShown = keys.backend === 'embedded' && keys.soft.state === 'running' && keys.soft.device !== 'unlocked';
  /* the soft key waiting on an API request (a sign, decrypt, HMAC, Edge) - its prompt below */
  const keyWaiting = useKeyWaiting(keys.backend === 'embedded' && keys.soft.state === 'running');
  /* the Edge copy kept current while the soft key runs - a restart keeps only its latest link */
  useEdgeBackgroundSync({
    enabled: keys.backend === 'embedded' && keys.soft.state === 'running' && emu.device === 'unlocked',
    waiting: keyWaiting,
  });

  /*
   * THE BLUETOOTH MASTER SWITCH, here rather than on its tab.
   *
   * The bar reports it on every screen, and the Bluetooth tab unmounts the
   * moment you look at another one - so the tab cannot be where it lives.
   * Off until said otherwise; the tab's Auto panel is the only thing that
   * turns it on by itself, and only because someone asked it to.
   */
  const [btOn, setBtOn] = useState(false);

  /* Read here, acted on by RadioStatus, edited by the Bluetooth tab. */
  const auto = useBtAuto();
  /* the desktop: the CLI on this computer answered by the same host as Bluetooth on the phone */


  const hid = useUsbHid({log: usbLog.log});
  const testing = useTestingMode();
  /* the key in use answered as an Edge key at the identity check: its Edge tab shows on every platform (src/features/core.tsx edge) */
  const keyId = useKeyIdentity();
  const keyHasEdge = keyId?.kind === 'read' && !!keyId.edgeIdentity;
  /* testing mode: the soft key's firmware console also goes to logcat (useOkEmu) */
  useEffect(() => {
    setFirmwareConsoleToLogcat(testing.enabled);
    setTestingMode(testing.enabled);
  }, [testing.enabled]);

  /*
   * A HARD KEY TURNS TESTING MODE ON, in a debug build.
   *
   * "Enter testing mode" lives only on the login screen, and a hard key can
   * walk straight past that screen: the door opens on the device's own state,
   * and a key that is already unlocked - as it is straight after
   * hardKeyProvision, which unlocks it and hands it back without a power
   * cycle - lands the app in `main`. With no button to press and no Testing
   * item in the drawer, the key was plugged in and nothing on the phone could
   * drive it. tools/e2e.js hit exactly this: it waited out its 60 s for the
   * button and then found no Testing item to open.
   *
   * So plugging one in turns the mode on. The bench owner's rule, 2026-09-24:
   * "if its a hardkey, enable testing mode IF build is debug". The debug half
   * needs no check here - useTestingMode's setEnabled is a no-op unless
   * __DEV__ (useTestingMode.ts:53), so a release build cannot reach this.
   *
   * Keyed on the BACKEND CHANGING, not on every render, so it fires once when
   * the hard key becomes the active one and then leaves the switch alone:
   * someone who turns testing mode off with the key still plugged in keeps it
   * off. It is not turned back off when the key leaves, either - the mode is
   * unpersisted already, and switching it off under a running suite would
   * pull its tab away mid-run.
   */
  useEffect(() => {
    if (keys.backend === 'usb') testing.setEnabled(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys.backend]);

  /*
   * CONFIG MODE — step one of putting it back, and it is the APP'S OWN FLAG.
   *
   * The idea it serves: config mode decides which features the app offers.
   * Some things can be used in it, some cannot. That is what it is for.
   *
   * At THIS step it decides nothing. Nothing reads it, nothing is gated, no
   * device is asked about it. It can be switched in testing mode and it shows
   * a banner. That is the whole of it, deliberately.
   *
   * IT IS NOT A READING OF THE KEY, and the comment that used to sit here said
   * it was. The version removed in 98f8760 carried a flag four different things
   * could set, interpreted by six screens, none of which agreed - and on a
   * production hard key one tap turned it all on with the key untouched. So
   * this one claims nothing it cannot back up: it is a switch with a light on
   * it, and each thing it controls gets attached on purpose, one at a time.
   */
  const [configMode, setConfigMode] = useState<ConfigState>(OFF);

  /*
   * THE LOCK IS THE ONLY THING CONFIG MODE SAYS ABOUT ITSELF.
   *
   * The gesture sets `configmode = true`, sets `unlocked = false` and re-arms
   * the 1 Hz INITIALIZED broadcast (OnlyKey.ino:898-904, unchanged back to
   * v3.0.2). So a key that was asked to enter config mode and then announces
   * that it is locked, has entered it. That is the whole detector.
   *
   * Earlier in this rebuild I wrote that `emu.device` never goes to 'locked'
   * here "so there was no edge to catch" - that was wrong, and checking it
   * against the pinned firmware rather than against memory is what turned
   * three states into something the app can actually follow. What IS silent is
   * the unlock afterwards, which is why state 1 needs a button.
   *
   * Guarded on WANTED, so an ordinary lock - the idle timer, button 3 - does
   * not get read as config mode.
   */
  useEffect(() => {
    if (configMode === WANTED && emu.device === 'locked') setConfigMode(PRE);
  }, [configMode, emu.device]);

  /*
   * CHANGING KEY WHILE IN CONFIG MODE RESTARTS THE APP - EITHER DIRECTION.
   *
   * `configMode` is one app-wide flag and it describes the SOFT key, while
   * `emu` is whichever key is ACTIVE. The moment the hard key becomes active
   * the app would be carrying a belief about one device onto another: graying
   * what works and offering what does not.
   *
   * Clearing the flag instead would be worse. The soft key really IS still in
   * config mode - the firmware assigns `configmode` in exactly two places, the
   * boot initializer and the button-6 gesture, with no `configmode = false`
   * anywhere - and it cannot boot in place, because the emulator thread only
   * exits through the AIRCR trap. A new process resolves both, and restarting
   * is what the panel has been saying all along.
   *
   * BOTH DIRECTIONS. Inserting was the case this was built for; pulling the
   * key back out is the same problem mirrored. On a REMOVAL the hard key's own
   * config mode died with it - unplugging is a boot - and the app falls back
   * to the soft key, which is a different device with a different answer. A
   * flag that survived that would describe neither.
   *
   * ON THE ACTIVE BACKEND, NOT ON ATTACHMENT, and the difference matters. An
   * earlier version fired when `keys.attached` became true; useKey.ts:258
   * resolves `override > (auto && attached) > embedded`, so in manual mode or
   * with an 'embedded' override a plugged-in key leaves the soft key active -
   * and that version threw the session away for a switch that never happened.
   * In auto mode with no override, inserting a key IS switching to it, and
   * pulling it out IS switching back.
   *
   * Launch is not a switch: `backend` starts 'embedded', so a key already
   * attached produces embedded -> usb on the first poll - but the state is OFF
   * at launch, so nothing fires. The guard is the flag, not the edge.
   */
  const previousBackend = useRef(keys.backend);
  useEffect(() => {
    const from = previousBackend.current;
    previousBackend.current = keys.backend;
    if (from === keys.backend || configMode === OFF) return;
    /*
     * THE ONLY AUTOMATIC RESTART IN THE APP - every other caller is a button
     * somebody pressed. It kills this process and relaunches, so it says why
     * on the way out; a screen that vanishes with no explanation reads as a
     * crash.
     */
    console.log(
      `[app] key changed ${from} -> ${keys.backend} at config state ${configMode} - restarting`,
    );
    void OkEmu.restartApp();
  }, [keys.backend, configMode]);

  /*
   * Ask whether the PIN went back in, because the key will not say.
   *
   * OKGETLABELS is on the config-mode allowlist (okcore.cpp:334 in every
   * pinned release) and is refused while locked, so a label read that succeeds
   * is positive proof of an unlock - the proof the broadcast never gives,
   * since the UNLOCKED announcement is suppressed while in config mode
   * (OnlyKey.ino:707).
   *
   * A BUTTON, NEVER A TIMER. This began as a 2.5 s poll and that HURT PIN
   * ENTRY on a hard key: the probe writes on the vendor interface, and doing
   * that repeatedly while somebody is pressing buttons interferes with the
   * digits going in. The person pressing it has just finished their PIN and is
   * the one who knows.
   */
  const [checking, setChecking] = useState(false);
  const checkConfig = useCallback(async () => {
    setChecking(true);
    try {
      const {device} = await getActiveKey();
      const ok = await device.configModeReady({timeoutMs: 2500});
      console.log(`[config] label probe: ${ok ? 'UNLOCKED' : 'locked'}`);
      if (ok) {
        /* The app has no other way to learn this. */
        emu.markUnlocked();
        setConfigMode(ON);
      }
    } catch (e) {
      console.log(`[config] label probe failed: ${errText(e)}`);
    } finally {
      setChecking(false);
    }
  }, [getActiveKey, emu]);

  const [tab, setTab] = useState<Tab>('This Key');
  /* the app plugins start a moment after launch; their tabs appear then */
  usePluginsStarted();
  const currentTab = pluginTabs().find(t => t.name === tab);
  /* everything a tab may draw from (src/plugins/types.ts TabContext) - no tab reaches into this function */
  const tabContext: TabContext = {
    backend: keys.backend,
    unlocked: emu.state === 'running' && emu.device === 'unlocked',
    caps: emu.capabilities,
    blockScreenshots: BLOCK_SCREENSHOTS,
    keys,
    emu,
    configMode,
    wantConfigMode: () => setConfigMode(WANTED),
    checkConfig: () => void checkConfig(),
    checking,
    testing: testing.enabled,
    openTab: name => setTab(name),
    bt: BLUETOOTH_HERE ? {on: btOn, setOn: setBtOn, fido, auto} : null,
    dev: __DEV__
      ? {
          /* named for the device, not for the layer: both keys run firmware; "USB bytes" is the byte-level USB panel */
          buffers: {
            'Soft Key': {entries: emuLog.entries, clear: emuLog.clear},
            'Hard Key': {entries: hardLog.entries, clear: hardLog.clear},
            CTAP: {entries: fidoLog.entries, clear: fidoLog.clear},
            'USB bytes': {entries: usbLog.entries, clear: usbLog.clear},
          },
          hid,
          usb: {entries: usbLog.entries, clear: usbLog.clear},
          setConfigMode,
          beforeE2E: () => setBtOn(false),
        }
      : null,
  };

  /*
   * NOTHING STAGED FOR A SHARE OUTLIVES IT (Brad, 2026-10-04): a decrypted message,
   * a backup or an encrypted private key sits in the cache only while the share
   * sheet uses it. Wiped when the app goes to the background too - the native side
   * skips this while a share is in flight (opening the sheet backgrounds the app)
   * and wipes on the sheet's own result; MainApplication wipes at start.
   */
  useEffect(() => {
    const sub = AppState.addEventListener('change', st => {
      if (st === 'background') NativeShare.clearShared().catch(() => undefined);
    });
    return () => sub.remove();
  }, []);

  /*
   * BACK TO THE LAST TAB after a restart you asked for (src/resumeTab.ts).
   * Every in-app restart goes through OkEmu.restartApp, which waits for this
   * hook; the first time the app opens after a login, the tab comes back -
   * within five minutes of the restart, once.
   */
  const tabRef = useRef<Tab>(tab);
  tabRef.current = tab;
  useEffect(() => {
    OkEmu.beforeRestart = () => rememberTab(tabRef.current);
    return () => {
      OkEmu.beforeRestart = null;
    };
  }, []);
  const resumeChecked = useRef(false);

  const [drawer, setDrawer] = useState(false);
  const [phase, setPhase] = useState<Phase>(SPLASH_SEEN ? 'login' : 'splash');
  /* past the PIN, a newer web build asks (UpdateSheet) instead of reloading the page by itself (src/webUpdate.ts) */
  useEffect(() => { setLoggedIn(phase === 'identity' || phase === 'main'); }, [phase]);
  /*
   * A LOGIN THIS TAB KEPT (webSession.ts, chosen at the identity check): on a reload the login screen goes on by itself
   * - the key is asked (armWebKey), and the identity check opens the bucket with no press. Once a page load.
   */
  const keptGoneOn = useRef(false);
  useEffect(() => {
    if (!WEB_SESSION || phase !== 'login' || keptGoneOn.current || !keptSession()) return;
    keptGoneOn.current = true;
    console.log('[session] this tab kept its login - going on past the login screen');
    armWebKey();
    setLoggedInThisRun(true);
    setPhase('pin');
  }, [phase]);
  /* The first time inside after this process started: take the remembered tab, if any. */
  useEffect(() => {
    if (phase !== 'main' || resumeChecked.current) return;
    resumeChecked.current = true;
    /*
     * Only tabs that are SHOWN now. Testing mode is deliberately not kept
     * across a restart (see Log out), so the Testing and In-Development tabs
     * must not come back through here - the render's last branch IS the
     * Testing screen, and this would walk round its gate.
     */
    const valid: readonly string[] = shownTabs({testing: testing.enabled, testingLocked: testing.enabled && !passed, keyHasEdge}).map(x => x.name);
    void takeResumeTab(valid).then(remembered => {
      if (remembered) setTab(remembered as Tab);
    });
  }, [phase, testing.enabled]);
  /*
   * The splash plays its animation to the end (AnimatedLogo, 3 s - the
   * owner's choice) even when the key boots faster, so it cannot be cut off
   * half-spread. Leaving it waits for this AND for the firmware to settle.
   */
  const [splashDone, setSplashDone] = useState(SPLASH_SEEN);
  /* the splash also waits for the web app's update check (a newer build reloads the page from there) */
  const [webReady, setWebReady] = useState(!WEB_SESSION);
  useEffect(() => { void webChecked.then(() => setWebReady(true)); }, []);

  /*
   * LOG IN STARTS THE SOFT KEY (a build with testing mode; Brad, 2026-10-07): once
   * it answers, a blank key goes to setup and any other to the PIN - the same
   * choice the button makes when the key is already running.
   */
  /*
   * Before the login screen starts any soft key: the clean start's phone side, once
   * (src/edgeV1.ts), then a Clear testnet asked from the testnet (src/testnet.ts).
   */
  useEffect(() => {
    void resetEdgeStoreOnce().catch((e: unknown) => console.log('[edge] the clean start did not finish: ' + String(e)));
  }, []);
  useEffect(() => {
    void clearIfScheduled().catch((e: unknown) => console.log(`[testnet] the scheduled clear failed: ${String(e)}`));
  }, []);
  const [continuing, setContinuing] = useState(false);
  /* the chain the soft key runs on (src/net.ts) - set when it starts, for the TESTNET banner */
  const [net, setNetShown] = useState<Net>(currentNet());
  useEffect(() => onNet(setNetShown), []);
  useEffect(() => {
    if (!continuing) return;
    if (emu.device === 'uninitialized') setPhase('setup');
    else if (emu.device === 'locked' || emu.device === 'unlocked') setPhase('pin');
    else return;
    setContinuing(false);
  }, [continuing, emu.device]);
  /* a firmware already running keeps its net; switching needs the app restarted (src/net.ts) */
  const warnNet = (want: Net) => (got: Net) => {
    if (got !== want) Alert.alert(got === 'test' ? 'The soft key is on the testnet' : 'The soft key is on the live chain', 'A started soft key cannot change its storage. Restart the app to switch.');
  };

  /*
   * The door opens and closes on what the DEVICE says, not on a local flag.
   *
   * Lock state arrives as the firmware's own once-a-second broadcast, so this
   * follows it: unlocking anywhere lands you in the app, and the device
   * locking itself - the idle timer, or a two-second hold on button 3 - puts
   * the door back.
   */
  /*
   * A KEY SWITCH CLOSES THE DOOR (box, 2026-10-24: a hard key plugged in while the soft key was open showed
   * "Hard Key" with the SOFT key's identity - and the hard key still locked). Another key - the other
   * backend, a hard key plugged in or out - goes through the door again: its own unlock, its own identity
   * check. Before the door effect below, which re-evaluates on it.
   */
  const doorKey = `${keys.backend}:${String(keys.attached)}`;
  const lastDoorKey = useRef(doorKey);
  /* after a switch, the door waits for THIS key's unlock - testing mode too (Brad, 2026-10-24: hard key out of the Pixel, soft key not logged in, and the app was still inside) */
  const awaitingUnlock = useRef(false);
  /* past the identity check for this unlock (its Continue / Decrypt Bucket); a lock or a key switch takes it back */
  const [passed, setPassed] = useState(false);
  /* the idle timer runs while someone is in the app (src/idleTimer.ts; the web app only for now) */
  useEffect(() => { setIdleRunning(phase === 'main' && passed); }, [phase, passed]);
  /*
   * THE IDENTITY'S ROOM ON THE USER'S SERVER (src/serverRoom.ts): joined once the bucket is open, left when it closes.
   * The web app's server is the one that served it; the phone's and the desktop's, the key's site (or the Sync tab's
   * Server panel). The room is THE sync (2026-10-30: the cli pair's Bluetooth sync and the desktop's sync service went).
   */
  useEffect(() => {
    if (passed) void joinServerRoom();
    else leaveServerRoom();
  }, [passed]);
  useEffect(() => {
    if (lastDoorKey.current === doorKey) return;
    lastDoorKey.current = doorKey;
    awaitingUnlock.current = true;
    /* another key while inside: this tab's kept login ends with the door (not a key first armed on a page load) */
    if (passed) void endSession('another key');
    setPassed(false);
    closeBucket();
    setPhase(prev => (prev === 'main' || prev === 'identity' ? 'login' : prev));
  }, [doorKey]);
  useEffect(() => {
    if (emu.device === 'unlocked') awaitingUnlock.current = false;
    /*
     * CONFIG MODE HAS NO IDENTITY CHECK (Pixel, 2026-10-25: the PIN typed for config mode sent the app to the identity
     * check, which spun - in config mode the key takes settings writes, not the bucket identity's derive). Config mode
     * open: the app opens on every tab for the settings work, with no bucket opened (its stores read nothing and refuse
     * writes); a restart leaves config mode. Waiting for its check (PRE) the key is not opened either - testing mode
     * stays on This Key and Testing, where "Check config mode" is.
     */
    if (configMode === ON && emu.device === 'unlocked') {
      closeBucket();
      if (!passed) setPassed(true);
      setPhase('main');
      return;
    }
    /*
     * TESTING MODE (Brad, 2026-10-25: "after pressing Enter testing mode it should go to the TESTING tab"; "the softkey
     * should still be locked after entering testing mode"; "it should lock into testing mode and never go out until
     * app restart"). With the key locked - or a key switch still waiting for this key's unlock - the app is open on the
     * Testing tab alone, with no bucket open. Its unlock (Login Bypass) goes through the identity check, which skips
     * the PIN but not which identity the key is; then every tab.
     *
     * ONLY AFTER A LOGIN IN THIS RUN. Testing mode also turns itself on (a hard key in a debug build, the web dev
     * server, a testnet soft key adopted) - and on its own it skipped the splash and the login into the locked Testing
     * tab, where a hard key or an already unlocked soft key had no Login Bypass and nothing could log in. Until the
     * login screen's Log in or Enter testing mode, the run takes the ordinary path below (splash, then login).
     */
    if (testing.enabled && loggedInThisRun) {
      if (emu.device === 'unlocked' && !awaitingUnlock.current && configMode !== PRE) {
        setPhase(prev => (prev === 'identity' || (prev === 'main' && passed) ? prev : 'identity'));
      } else {
        if (passed) { setPassed(false); void endSession('the key locked'); }
        closeBucket();
        setPhase('main');
      }
      return;
    }
    /*
     * THE DOOR STAYS SHUT AT PRE, and it has to be held shut deliberately.
     *
     * Typing the PIN in config mode makes the app see 'unlocked' by itself:
     * useOkEmu.ts:725-737 sends OKCONNECT once a digit settles while locked,
     * and the firmware answers UNLOCKED from inside config mode (okcore.cpp
     * :1317 in v3.0.4, :1315 in v3.0.2 - not a new branch). Without this
     * clause the tabs would come back the instant the PIN landed, taking the
     * "Check config mode" button with them before anyone could press it.
     *
     * The fallthrough below returns `prev` for 'pin', so the PIN view simply
     * stays. Pressing the check sets ON and the next run opens the door.
     */
    if (emu.device === 'unlocked' && configMode !== PRE && loggedInThisRun) {
      /* a fresh unlock goes through the identity check first; an open app stays open */
      setPhase(prev => (prev === 'main' || prev === 'identity' ? prev : 'identity'));
      return;
    }
    setPhase(prev => {
      /*
       * Leaving the splash needs the firmware settled, either way it went - except
       * in a build with testing mode, where nothing starts until the login screen's
       * Log in or Enter testing mode picks the net (useOkEmu ensureStarted, Brad
       * 2026-10-07): there 'stopped' is the settled state.
       */
      if (prev === 'splash' && splashDone && webReady && (emu.state !== 'stopped' || __DEV__) && emu.state !== 'starting') {
        return 'login';
      }
      // It relocked while we were inside (or at the identity check).
      if (prev === 'main' || prev === 'identity') {
        /* the door closed: the opened bucket goes with it, and a login this tab kept (webSession.ts) */
        closeBucket();
        void endSession('the key locked or was unplugged');
        setPassed(false);
        /*
         * WHY THE DOOR CLOSED, to logcat.
         *
         * Reported 2026-09-17: leave the app and come back and it asks to log
         * in again, with the key still unlocked. This transition is the only
         * thing that can produce that, and it left no trace - so from outside
         * "the firmware relocked" and "the app lost track of the firmware"
         * looked identical, which is the same hole the Bluetooth keyboard had.
         */
        console.log(
          `[door] main -> login: device=${emu.device} state=${emu.state} testing=${testing.enabled}`,
        );
        return 'login';
      }
      return prev;
    });
    /*
     * `configMode` is in here for the clause above: the PRE -> ON flip is the
     * ONLY thing that changes when the check passes - `emu.device` has been
     * 'unlocked' since the PIN landed - so without it the door would never
     * reopen and the check button would look dead.
     */
  }, [testing.enabled, emu.device, emu.state, configMode, splashDone, webReady, doorKey, passed, loggedInThisRun]);

  /* testing mode before the identity check: only This Key and Testing are shown - any other tab goes to Testing */
  useEffect(() => {
    if (testing.enabled && !passed && phase === 'main' && !shownTabs({testing: true, testingLocked: true, keyHasEdge}).some(x => x.name === tab)) setTab('Testing');
  }, [testing.enabled, passed, phase, tab]);

  const ready = phase === 'main';

  /*
   * Locking forgets everything learned while unlocked. The epoch is a remount
   * key for the screens; the hook also drops the library's cached vault keys,
   * which are not React state and would survive a remount.
   */
  const sessionEpoch = useWipeOnLock(ready);

  /*
   * The drawer does not survive the door.
   *
   * Its open flag is independent of the phase, so a drawer left open when the
   * device locked came straight back the moment you unlocked - the app opened
   * onto a menu nobody had asked for. Closing it on the way out is simpler
   * than making every exit remember to.
   */
  useEffect(() => {
    if (!ready) {
      setDrawer(false);
    }
  }, [ready]);

  return (
    /*
      EVERY SCREEN BELOW READS THE ACTIVE KEY THROUGH THIS.

      Without it they all called getOnlyKey() with no argument and got the
      soft key, so the header could say Hard Key over a screen showing the
      soft one's slots. See KeyContext.tsx for why a provider rather than a
      module-level setter.
    */
    <KeyBackendProvider backend={keys.backend}>
      {/*
        * INSIDE KeyBackendProvider, because the forwarder reads `useBackend()`
        * to choose which pipe it listens on - the soft key's stream or the hard
        * key's. Outside it, the bridge would forward the wrong key's typing.
        */}
      <BtKeyboardProvider>
      <IoPolicySync setTarget={fido.setTarget} />
      <StatusBar barStyle="light-content" />
      {/* the sheets (the Edge request, the key's prompts) are features' watches: src/features/core.tsx */}

      {/* app plugins' watches run whatever tab is open (the Password Manager closes a key's store when it locks) */}
      {pluginWatches().map((Watch, i) => (
        <Watch
          key={i}
          unlocked={{
            embedded: keys.soft.state === 'running' && keys.soft.device === 'unlocked',
            usb: keys.hard.state === 'running' && keys.hard.device === 'unlocked',
          }}
          openTab={name => setTab(name as Tab)}
          keyWaiting={keyWaiting}
          presence={{needed: fido.presenceNeeded, canPress: emu.canPress === true, confirm: fido.confirm}}
        />
      ))}
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        {ready ? (
          <View style={styles.bar}>
            <Pressable
              onPress={() => setDrawer(true)}
              accessibilityRole="button"
              accessibilityLabel="Menu"
              style={({pressed}) => [styles.barLeft, pressed && styles.pressed]}>
              {/*
                The wordmark, not the square mark: that asset is not
                transparent, so tinting it white fills the whole square.
              */}
              <Logo height={17} />
              <Text style={styles.barSep}>|</Text>
              <Text style={styles.barTitle}>{tab}</Text>
            </Pressable>
            {/*
              WHICH KEY, ON EVERY TAB.

              The lock pill has always said what the device is doing. It did
              not say WHICH device, and once there are two that is a gap on
              every screen rather than one: "12 slots, 3 configured" is a
              different fact about a soft key than about the one in your hand,
              and nothing on the Slots tab said which it had read.

              Here rather than per screen, because the answer is the same
              everywhere and repeating it eleven times is eleven chances to
              disagree.

              It leads to This Key, for the same reason the radio icons lead to
              Bluetooth: each is a summary of one tab, and a summary you cannot
              follow back to the thing it summarises is a dead end.
            */}
            {/*
              WHAT THE RADIO IS DOING, on every tab.

              Three things can be true at once here - the radio is on, the
              keyboard is published, the authenticator is advertising - and
              each of them is either merely ENABLED or actually CONNECTED to
              something. That is six states, and the Bluetooth tab is the only
              place any of it was visible. A keyboard silently not typing is
              the failure this app keeps having; this is where it shows.

              Blue is armed, green is connected, grey is off.
            */}
            {/*
              THE STATUS ICONS, ONE GROUP (Brad, 2026-10-29: "a single activity panel, containing all icons so they're
              not spaced or separated - a press on any icon takes you to the same panel now"): the phone's radio icons
              (no Bluetooth on the desktop, none needed on the web - BLUETOOTH_HERE, a platform value), then the MCP (🔗, the server's
              room - the sync) on every platform, and the desktop's pipe to the CLI (>_). Any of them opens the Activity tab, which leads on to each one's own tab.
            */}
            <View style={styles.barMid}>
              {pluginChannels().map(c => <Fragment key={c.name}>{c.icon({openTab: name => setTab(name), bt: tabContext.bt})}</Fragment>)}
            </View>

            <Pressable
              onPress={() => setTab('This Key')}
              accessibilityRole="button"
              accessibilityLabel="Key status"
              style={({pressed}) => [styles.barRight, pressed && styles.pressed]}>
              <Text style={styles.barKey}>{keys.name}</Text>
              <StatusPill
                state={emu.device}
                label={emu.device === 'unknown' ? emu.state : emu.device}
                dotColor={keys.backend === 'embedded' ? ledColor(emu.led) : null}
              />
            </Pressable>
          </View>
        ) : null}

        {/* the banners (src/features/banners.tsx): whichever this platform's list registered, in order */}
        {pluginBanners().map(b => (
          <Fragment key={b.name}>
            {b.render({
              testing: testing.enabled,
              devLogin: devLoginShown ? () => void devLogin() : null,
              configMode,
              halted: keys.backend === 'embedded' && keys.soft.state === 'halted',
              atLogin: phase === 'login',
            })}
          </Fragment>
        ))}


        {/*
          THE KEYBOARD MUST NOT COVER THE FIELD BEING TYPED IN.
          With edge-to-edge on (gradle.properties edgeToEdgeEnabled, target SDK
          36) Android no longer resizes the window for the keyboard, so the
          manifest's adjustResize does nothing: the keyboard is drawn over the
          app and every field below its top edge was typed into blind. One
          wrapper here, around every tab, shrinks the content by the keyboard's
          height instead, so the tab's ScrollView can bring the field into view.
        */}
        <KeyboardAvoidingView style={styles.body} key={sessionEpoch} behavior="padding">
          {phase === 'splash' ? (
            <SplashScreen onDone={() => {
              setSplashDone(true);
              try { NativeOkEmu.markSplashDone?.(); } catch {}
            }} />
          ) : phase === 'login' ? (
            <LoginScreen
              device={emu.device}
              attached={keys.attached}
              keyVersion={keys.hard.version}
              picked={keys.backend === 'embedded' && keys.soft.state === 'running' ? net : null}
              /*
                Straight to the Testing tab, not This Key. Someone who turns
                testing mode on from the door is going there next - it is the
                only reason the button exists.
              */
              onTesting={() => {
                /* the testnet's own soft key (src/net.ts): started here, before anything reads it */
                if (keys.backend === 'embedded') void keys.soft.ensureStarted('test').then(warnNet('test'));
                /* on, never toggled: testing mode lasts until the app restarts (Brad, 2026-10-25) */
                testing.setEnabled(true);
                setLoggedInThisRun(true);
                setTab('Testing');
              }}
              onContinue={() => {
                /* first: the branch below returns before the PIN, and that PIN's unlock must find this run logged in */
                setLoggedInThisRun(true);
                if (keys.backend === 'embedded' && keys.soft.state === 'stopped') {
                  /* start the live soft key; the effect above picks setup or PIN once it answers */
                  setContinuing(true);
                  void keys.soft.ensureStarted('live').then(warnNet('live'));
                  return;
                }
                /* the web app asks its key nothing until now (useWebKey armWebKey); an unlocked key then goes on to the identity check */
                if (KEY_WAITS_FOR_LOGIN) armWebKey();
                // A blank key has no PIN to enter; it needs one chosen.
                setPhase(emu.device === 'uninitialized' ? 'setup' : 'pin');
              }}
            />
          ) : phase === 'setup' ? (
            <SetupScreen
              onDone={() => setPhase('login')}
              model={emu.model}
              onProvision={emu.provision}
              led={keys.backend === 'embedded' ? emu.led : undefined}
            />
          ) : phase === 'identity' ? (
            <IdentityCheckScreen key={doorKey} keyName={keys.backend === 'usb' ? 'Hard Key' : 'Soft Key'} onContinue={() => { setPassed(true); setPhase('main'); }} onPress={keys.backend === 'embedded' ? () => void emu.press(1) : undefined} />
          ) : phase === 'pin' ? (
            <PinScreen
              onBypass={keys.backend === 'embedded' && keys.soft.state === 'running' ? () => void devLogin() : undefined}
              onPress={emu.press}
              onPressRun={emu.pressRun}
              canPress={emu.canPress}
              model={emu.model}
              settling={emu.settling}
              led={keys.backend === 'embedded' ? emu.led : undefined}
              /*
               * OFFERED ONLY WHEN THERE IS SOMETHING TO CHOOSE BETWEEN. With
               * no hard key on the bus the row would be two options one of
               * which does nothing, so it is not drawn at all.
               *
               * Picking writes the OVERRIDE rather than the mode: the mode is
               * a standing preference ("prefer the hard key when one is
               * attached"), and this is someone saying which key they mean
               * right now, for this login.
               */
              keyPick={
                /* where there is no soft key (the web app), the hard key is the only key: nothing to pick */
                keys.attached === true && SOFT_KEY_HERE
                  ? {
                      value: keys.backend === 'usb' ? 'Hard key' : 'Soft Key',
                      onChange: next =>
                        keys.setOverride(next === 'Hard key' ? 'usb' : 'embedded'),
                    }
                  : null
              }
              onBack={() => setPhase('login')}
              /*
                The door is where someone stands when config mode has locked
                the key and the unlock will never be announced. The panel on
                Keys and Backup cannot help from here.
              */
              configMode={configMode === PRE}
              onCheckConfig={() => void checkConfig()}
              checking={checking}
            />
          ) : currentTab ? (
            currentTab.render(tabContext)
          ) : null}
        </KeyboardAvoidingView>

        <Drawer
          open={drawer && ready}
          tabs={shownTabs({testing: testing.enabled, testingLocked: testing.enabled && !passed, keyHasEdge}).map(x => x.name)}
          value={tab}
          onChange={setTab}
          onClose={() => setDrawer(false)}
          /*
           * LOG OUT, which is a RESTART - and that is not a workaround.
           *
           * There was no way out of the app at all: once past the door every
           * screen assumed an unlocked key, and the only exit was swiping the
           * app away. The menu's footer held "Enter testing mode" instead,
           * ungated, which is what shipped a PIN bypass in a release.
           *
           * Restarting IS the logout for the soft key. Its firmware runs in
           * this process and `initialized` is recomputed from flash only in
           * setup(), so there is no in-process way to re-lock it - the thread
           * only exits through the AIRCR trap. A new process boots the key
           * locked, which is the state a logout is asking for.
           *
           * It also clears testing mode, which is deliberately unpersisted, so
           * a development session cannot leave the gate down for the next one.
           *
           * WHAT IT DOES NOT DO is lock a HARD key. That is a physical device
           * holding its own unlocked state, and nothing here can put it back -
           * the firmware only locks on the button 3 gesture, which also
           * restarts it. So the button says "Log out" rather than "Lock", and
           * the hard key's own state is its own.
           */
          footer={
            <Btn
              title="Log out"
              onPress={() => {
                /* every shell (src/logOut.ts): the web app had no restart, so the button did nothing there */
                void logOut();
              }}
            />
          }
        />
        {/* the session's time left: a thin line along the bottom (src/ui/IdleBar.tsx) */}
        <IdleBar quiet={testing.enabled} />
      </SafeAreaView>
      </BtKeyboardProvider>
    </KeyBackendProvider>
  );
}

/*
 * THE SOFT KEY HAS STOPPED - and on the login page, the app restarts itself
 * after a minute (owner, 2026-10-01).
 *
 * On the login page there is nothing else to do: no key, so no way in, and
 * an app left open there just sits. So it counts down and restarts (the
 * resume hook still runs - see src/resumeTab.ts), with Cancel for someone who
 * wants to read the screen first. Elsewhere a restart would throw away what
 * is on screen, so it waits to be asked, as before.
 */

const styles = StyleSheet.create({
  /* Each button an equal share of the row; alone (after Cancel), the whole row. */
  safe: {flex: 1, backgroundColor: theme.bg},
  /*
   * No manual bottom padding. SafeAreaView already insets the bottom edge, and
   * adding Math.max(insets.bottom, 12) on top of it counted the same inset
   * twice - which is the gap that appeared above the navigation bar.
   */
  body: {flex: 1, paddingHorizontal: 16},

  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
  },
  barLeft: {flexDirection: 'row', alignItems: 'center', gap: 10},
  barRight: {flexDirection: 'row', alignItems: 'center', gap: 8},
  barMid: {flexDirection: 'row', alignItems: 'center', gap: 12},
  barIcon: {fontSize: 17},

  /* Quiet: it is context, not a headline. The pill beside it is the state. */
  barKey: {color: theme.textDim, fontSize: 12},

  barTitle: {color: theme.text, fontSize: 16, fontWeight: '700'},
  barSep: {color: theme.border, fontSize: 15},
  pressed: {opacity: 0.6},



  prompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.warn,
    backgroundColor: 'rgba(252, 211, 77, 0.10)',
  },
  promptText: {flex: 1},
  promptTitle: {color: theme.text, fontSize: 14, fontWeight: '700'},
  promptBody: {color: theme.textDim, fontSize: 11, marginTop: 2, lineHeight: 15},
});

/*
 * THE PHONE'S BLUETOOTH CHANNEL (ᛒ ⌨ ⚿): the radio, the keyboard, the security key - their status icons, the thing that
 * starts them (RadioStatus, below: its off/on recovery included), and the Activity card. The phone's list only
 * (src/features/list.android.ts): the desktop has no Bluetooth of its own and the web app reaches keys by WebAuthn.
 */
import React, {useEffect, useRef, useState} from 'react';
import {Pressable, Text} from 'react-native';
import NativeFidoGatt from 'okedge-native/specs/NativeFidoGatt';
import {stateColor, theme} from '../../ui/theme';
import {Btn, Section} from '../../ui/components';
import {barStyles, useIoPurple} from '../../ui/statusBar';
import {useSharedBtKeyboard} from '../../hooks/BtKeyboardContext';
import type {FidoSession} from '../../hooks/useFidoGatt';
import type {BtAuto} from '../../hooks/useBtAuto';
import {Row, lastOf, useNow} from './rows';
import {channelPlugin} from './plugin';

const styles = barStyles;

/* while waiting for Bluetooth to be ready after the phone's Bluetooth came back: ask this often (RadioStatus) */
const READY_ASK_MS = 1500;
/* how many times the Bluetooth off/on sequence restarts ours to land where the computer knows it */
const LAYOUT_MAX_TRIES = 5;

/**
 * Bluetooth, keyboard, authenticator - blue armed, green connected, grey off.
 *
 * AND the thing that starts them, which is not a coincidence.
 *
 * Auto-start used to live on the Bluetooth screen, where it did nothing until
 * you opened the Bluetooth tab - the one component certain not to be mounted
 * at the moment "start on app start" is about. It belongs wherever is mounted
 * for the life of the app, and these icons are exactly that: they report the
 * radio on every tab, so they are always here to act on it.
 *
 * A component rather than three expressions in App, because it reads the
 * keyboard session through the context that App WRAPS but is not inside -
 * calling the hook in App's own body throws.
 */
function RadioStatus({
  on,
  setOn,
  fido,
  auto,
  onPress,
}: {
  on: boolean;
  setOn: (next: boolean) => void;
  fido: FidoSession;
  auto: BtAuto;
  /** Opens the Bluetooth tab - the icons are a summary of it, so they lead there. */
  onPress: () => void;
}) {
  const btk = useSharedBtKeyboard();
  const published = btk.state !== 'unregistered' && btk.state !== 'unsupported';
  const linked = btk.state === 'connected';
  const advertising = fido.state === 'advertising' || fido.state === 'connected';

  /*
   * THE PHONE'S BLUETOOTH GOING OFF AND ON IS AN APP RESTART FOR OUR BLUETOOTH
   * (Brad, 2026-10-04, from his own fix by hand on the Pixel).
   *
   * What went wrong: after a Bluetooth off/on the app still held the computer as
   * connected, rebuilt its services before the fresh stack was ready, and a
   * computer's discovery then hung until the app restarted; and the "not ready"
   * empty list during the switch erased the saved target. His sequence fixed it:
   *   radio off -> remember the target, switch to None (drop the connection);
   *   radio on  -> once Bluetooth is READY, the in-app switch off; once ours has
   *                STOPPED, on again (as on an app start); once the keyboard is
   *                published, pick the remembered computer again.
   * Every step waits on FEEDBACK from the native side, never a timer (Brad:
   * "never use timers if we can get feedback"). Only while the in-app switch is on.
   */
  type Step = 'idle' | 'waitReady' | 'waitStopped' | 'waitPublished' | 'waitLanded';
  const layoutTries = useRef(0);
  const step = useRef<Step>('idle');
  const lastRadio = useRef<boolean | null>(null);
  const resumeHost = useRef<string | null>(null);
  useEffect(() => {
    const r = btk.radioOn;
    const prev = lastRadio.current;
    lastRadio.current = r;
    if (r === null || prev === null || r === prev) return;
    if (!r) {
      step.current = 'idle';
      if (btk.chosenHost) resumeHost.current = btk.chosenHost;
      if (btk.chosenHost) void btk.chooseHost(null).catch(() => {});
      return;
    }
    if (!on) return;
    /* ready = the native side got a real answer for the paired computers (an empty one counts) */
    layoutTries.current = 0;
    step.current = 'waitReady';
    setAskingReady(true);
    if (btk.ready === true) stopOurs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [btk.radioOn]);
  /*
   * THE SAME CHECK AT APP START (2026-10-05). An app that starts before the
   * system's services are in (after a phone restart, an update) lands ours ahead
   * of them, exactly as after a radio toggle - and a computer that knew the
   * other order could not discover us. Once ours first advertises: not where a
   * computer last COMPLETED a message with us -> the same restart sequence.
   * An unknown position (nothing completed yet) is left as it is: a first start
   * already lands after the system's services.
   */
  const startChecked = useRef(false);
  useEffect(() => {
    if (startChecked.current || !on || !advertising || step.current !== 'idle') return;
    startChecked.current = true;
    const now = NativeFidoGatt.fidoHandle();
    const known = NativeFidoGatt.fidoKnownHandle();
    if (known <= 0 || now === known) return;
    console.log(`[bt] app start: our FIDO service at ${now}, a computer last completed with it at ${known} - restarting ours`);
    layoutTries.current = 0;
    resumeHost.current = btk.chosenHost ?? null;
    step.current = 'waitReady';
    setAskingReady(true);
    if (btk.ready === true) stopOurs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advertising, on]);
  useEffect(() => {
    if (step.current === 'waitReady' && btk.ready === true) stopOurs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [btk.ready]);
  /*
   * A timer that LOOKS for that feedback, never one that replaces it (Brad: "timers
   * are good for finding feedback"): while waiting, ask for the paired computers
   * every READY_ASK_MS, in case the last status event came a moment too early.
   * It stops as soon as the answer comes (or Bluetooth goes off again).
   */
  const [askingReady, setAskingReady] = useState(false);
  useEffect(() => {
    if (!askingReady) return undefined;
    const t = setInterval(() => {
      if (step.current !== 'waitReady') return setAskingReady(false);
      void btk.refreshHosts().catch(() => {});
    }, READY_ASK_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askingReady]);
  /* our Bluetooth off, exactly like the in-app switch (the teardown follows the switch, below) */
  function stopOurs() {
    setAskingReady(false);
    step.current = 'waitStopped';
    setOn(false);
  }
  /* on again only when ours has really stopped: keyboard withdrawn and the GATT server down */
  const stopped = !published && !advertising;
  useEffect(() => {
    if (step.current !== 'waitStopped' || on || !stopped) return;
    step.current = 'waitPublished';
    setOn(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, stopped]);
  /*
   * ...and once ours is on again, the remembered computer, like choosing it from
   * None. NOT gated on the keyboard being published: when Bluetooth comes back
   * the native side republishes the keyboard itself, the app's own publish then
   * loses that race ("another app is registered") and the keyboard reads
   * "unregistered" - and choosing the computer is what brings it back (Brad,
   * 2026-10-05, round 3 on the Pixel). So choose as soon as the switch is on.
   */
  useEffect(() => {
    if (step.current !== 'waitPublished' || !on) return;
    step.current = 'waitLanded';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);
  /*
   * ...but first: DID OUR SERVICES LAND WHERE THE COMPUTER KNOWS THEM? (the cause,
   * measured 2026-10-05: Windows keys its entries by start handle and hung when
   * ours moved). Checked once ours is advertising again (feedback). Not where the
   * computer last read them -> ours went in before the system's services: restart
   * ours again (a timer only gives the system's services a moment to go in first;
   * the handle is the check), at most LAYOUT_MAX_TRIES times.
   */
  useEffect(() => {
    if (step.current !== 'waitLanded' || !advertising) return;
    const now = NativeFidoGatt.fidoHandle();
    const known = NativeFidoGatt.fidoKnownHandle();
    /*
     * No known position yet (no computer has read us since the app was installed):
     * restart ours ONCE anyway, so they land after the system's services like a
     * fresh start. Without this the computer could not enumerate, so it never read
     * us, so the position was never learned (the Pixel, 2026-10-05, test 2).
     */
    const unknownFirstTry = known <= 0 && layoutTries.current === 0;
    if ((unknownFirstTry || (known > 0 && now !== known)) && layoutTries.current < LAYOUT_MAX_TRIES) {
      layoutTries.current += 1;
      console.log(`[bt] our FIDO service landed at ${now}, the computer knows it at ${known} - restarting ours (try ${layoutTries.current})`);
      step.current = 'waitReady';
      setTimeout(() => { if (step.current === 'waitReady') stopOurs(); }, READY_ASK_MS);
      return;
    }
    console.log(`[bt] our FIDO service at ${now} (computer knows ${known}) - picking the computer again`);
    step.current = 'idle';
    const host = resumeHost.current;
    resumeHost.current = null;
    if (host) void btk.chooseHost(host).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advertising]);

  /*
   * OFF MEANS THE NATIVE TEARDOWN, WHOEVER TURNED IT OFF (Brad, 2026-10-04). It
   * lived only in the Bluetooth screen's switch handler, so any other path that
   * set the switch off (this sequence's first try, the e2e runner) left the
   * keyboard published and the GATT server running under a switch that said
   * off. On the edge from on to off only: at app start or after a JS reload the
   * switch reads off for a moment while the native server is still running,
   * and must not be torn down for that.
   */
  const prevOn = useRef(on);
  useEffect(() => {
    const was = prevOn.current;
    prevOn.current = on;
    if (!(was && !on)) return;
    if (published) void Promise.resolve(btk.withdraw()).catch(() => {});
    if (advertising) void Promise.resolve(fido.stop()).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);

  /* The radio, once storage has said so. */
  useEffect(() => {
    if (auto.ready && auto.autos.start) setOn(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto.ready, auto.autos.start]);

  /*
   * PRESENCE FOLLOWS THE RADIO, and nothing else.
   *
   * This used to wait for a chosen target before publishing the keyboard or
   * advertising 0xFFFD, which sounded careful and was the source of most of
   * this tab's trouble. A HOST READS A DEVICE'S SERVICE LIST EXACTLY ONCE,
   * WHEN IT PAIRS. Gating presence on a target made the first pairing with any
   * new computer the one pairing guaranteed to record neither service - and
   * the target list only holds computers already paired, so that was the
   * ordinary path, not an edge case. Worse, switching a feature off tore the
   * GATT server down, and Windows stops trusting a service node that keeps
   * vanishing: once dead, the WebAuthn stack stopped offering this phone at
   * all.
   *
   * So both services are offered for as long as Bluetooth is on. What the
   * switches on the Bluetooth tab now control is IO - whether keystrokes
   * cross the link, whether a request is relayed to the key - which is the
   * question someone was actually answering when they turned one off, and it
   * can be answered without ever changing what a host has recorded.
   *
   * Guarded on current state rather than run once, because the honest trigger
   * is "on, and not up yet" - which is also true after a host drops, after a
   * reload, and after the app is swiped away and reopened.
   */
  /*
   * THE RADIO COMING BACK IS ONE OF THOSE TRIGGERS, and it was missing.
   *
   * Reported 2026-09-19: turn Bluetooth off, turn it on again, and nothing
   * republished - the switches still said on, the Keyboard panel still said
   * unregistered. Neither `published` nor `advertising` changes when the
   * adapter goes away, so none of the deps moved and this never re-ran.
   *
   * `btk.radioOn` is the edge that was missing. It is re-read on every status
   * event, and the adapter receiver now emits on both edges, so flipping the
   * switch in Android settings brings both services back without the tab
   * being reopened.
   */
  useEffect(() => {
    if (!auto.ready || !on) return;
    if (btk.radioOn === false) return;
    if (!published && !btk.busy) void btk.publish();
    if (!advertising && fido.supported !== false) void fido.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto.ready, on, published, advertising, btk.radioOn]);

  const color = (enabled: boolean, connected: boolean) =>
    connected ? theme.ok : enabled ? theme.accentHover : theme.textDim;
  /*
   * Purple first (traffic), then the state. ⚿ is yellow while it advertises - the
   * advertising pill's colour on the Bluetooth tab (Brad, 2026-10-07) - and the only
   * icon that is: the key service is the one thing here advertised over BLE.
   */
  const anyIo = useIoPurple(() => true, true);
  const keyboardIo = useIoPurple(c => c === 'keyboard', false);
  const keyIo = useIoPurple(c => c === 'key', false);
  /*
   * NO GREEN (2026-10-30): ⚿ was green only between a cli-paired computer's hello
   * and goodbye (Brad, 2026-10-07) - its encrypted session, never the radio's
   * "connected", which RACED (Windows keeps a link ~3 s after a command, and the
   * next command's link shares its address). The cli pair went (Brad: "just remove
   * ble pair and sync stuff"), and with it the session; a link with none - a
   * browser's FIDO request, a lingering one - was always yellow, and blinks purple
   * on traffic. So yellow while the service is offered, purple on traffic.
   */
  const keyColor = keyIo ? theme.io
    : fido.state === 'advertising' || fido.state === 'connected' ? stateColor('advertising')
    : theme.textDim;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Bluetooth status"
      style={({pressed}) => [styles.barMid, pressed && styles.pressed]}>
      <Text style={[styles.barIcon, {color: anyIo ? theme.io : color(on, linked)}]}>{'ᛒ'}</Text>
      <Text style={[styles.barIcon, {color: keyboardIo ? theme.io : color(published, linked)}]}>
        {'⌨'}
      </Text>
      <Text style={[styles.barIcon, {color: keyColor}]}>
        {'⚿'}
      </Text>
    </Pressable>
  );
}


/* the keyboard's state in words - read inside the phone's keyboard provider, as the bar's ⌨ is */
function KeyboardState() {
  return <Text style={{color: theme.text, fontSize: 13}}>{useSharedBtKeyboard().state}</Text>;
}

function BluetoothCard({on, fido, openTab}: {on: boolean; fido: string; openTab: (name: string) => void}) {
  const now = useNow();
  return (
    <Section title="ᛒ ⌨ ⚿  Bluetooth">
      <Row label="radio" value={on ? 'on' : 'off'} />
      <Row label="key service (⚿)" value={fido} />
      <Row label="keyboard (⌨)" value={<KeyboardState />} />
      <Row label="key traffic" value={lastOf('key', now)} />
      <Row label="keystrokes" value={lastOf('keyboard', now)} />
      <Btn title="Bluetooth" onPress={() => openTab('Bluetooth')} />
    </Section>
  );
}

export const bluetoothChannel = channelPlugin({
  name: 'Bluetooth', order: 10,
  icon: ctx => ctx.bt ? <RadioStatus on={ctx.bt.on} setOn={ctx.bt.setOn} fido={ctx.bt.fido} auto={ctx.bt.auto} onPress={() => ctx.openTab('Activity')} /> : null,
  card: ctx => ctx.bt ? <BluetoothCard on={ctx.bt.on} fido={ctx.bt.fido.state} openTab={ctx.openTab} /> : null,
});

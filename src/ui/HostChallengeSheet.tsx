/*
 * THE CODE TO ENTER ON A HARD KEY THIS APP ASKED (src/hostChallenge.ts), shown wherever the person is - a key that waits
 * for a code no screen shows only times out (Brad: "a sheet for every press"). The shared Sheet, so the system bars and
 * the backdrop are its business. It closes itself when the key answers or gives up; nothing to tap.
 */
import React, {useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Sheet} from './Sheet';
import {PressIcon} from './PressIcon';
import {usePressSound} from './pressSound';
import {theme} from './theme';
import {hostChallenge, onHostChallenge, type HostChallenge} from '../hostChallenge';
import {activeBackend} from '../hooks/KeyContext';
import {keyBusy, onKeyBusy, viaTunnel, type KeyBusy} from '../keyBusy';

/*
 * THE KEY'S 20 SECONDS (Brad, 2026-10-31: "dont we have a press sheet with a timer for 20 seconds, i think thats the hold
 * up"; "need a timer on it"; "and sound"): the key gives up a press it waits for at 20 s (lib okcrypto, fadeoffafter20sec)
 * - the sheet counts them down from when it opened, as a thin line along its bottom (SheetCountdown, the idle bar's
 * look), and rings as every press sheet does (pressSound: soft at once, loud past 10 s).
 */
const KEY_WAIT_S = 20;

/*
 * IS THE PRESS SHEET UP (KeyBusySheet steps aside while it is): a press request's chunks are progress, and its sheet
 * shows on the last one, when the key waits (keyBusy asks) - not while the request is still going out, and not once the
 * key has the press. Over the tunnel a code is the request in flight's (a derive's): it shows when the key has that
 * request's last chunk (keyBusy delivered). A key straight on USB takes a request at once: its asks show as asked.
 */
export function hostSheetShows(c: HostChallenge | null, busy: KeyBusy | null): boolean {
  if (!c || activeBackend() !== 'usb') return false;
  /*
   * A SCREEN'S ASK WAITS FOR THE KEY'S WAIT (Brad, 2026-11-01: "the progress timer 20 sec is running before the press is
   * needed"): the login raises its ask before its budget request has even begun - over the tunnel the sheet (and its
   * 20 s) come when the key has the request's last chunk, and go when its answer comes.
   */
  if (c.screen && viaTunnel()) return !!busy && busy.asks;
  if (c.digits.length && viaTunnel()) return !!busy && busy.delivered;
  return !(busy && busy.press && !busy.done && !busy.asks);
}

export function HostChallengeSheet() {
  const [c, setC] = useState<HostChallenge | null>(hostChallenge());
  useEffect(() => onHostChallenge(setC), []);
  /*
   * ONLY WHILE THE KEY WAITS FOR THE PRESS (Brad, 2026-11-01: "we send a ctap knowing a button press needs to happen, so
   * we display the sheet for that request - after that, we hide the press sheet, and show the working with key progress
   * sheet"; "show the press sheet on the last chunk"): the request's chunks going out and its answer coming back are
   * KeyBusySheet's progress (hostSheetShows).
   */
  const [busy, setBusy] = useState<KeyBusy | null>(keyBusy());
  useEffect(() => onKeyBusy(setBusy), []);
  const shows = hostSheetShows(c, busy);
  /* when this wait began: the sheet coming up is the key's wait starting - the key's 20 s run from there */
  const [since, setSince] = useState<number | null>(null);
  useEffect(() => { setSince(shows ? Date.now() : null); }, [shows, c]);
  /* the moment a code is on screen - the key waits for it now (tools/drive presses a web app's code on this line) */
  useEffect(() => { if (shows && c && c.digits.length) console.log(`[press] code shows: ${c.what} - buttons ${c.digits.join(' ')}`); }, [shows, c]);
  usePressSound(shows && since !== null ? since : null, 'press');
  /* a hard key's only: the soft key's wait has its own sheet with its button (PressSheet, from the firmware's record) */
  if (!c || !shows) return null;
  return (
    <Sheet tone="press" title="Press the key" countdown={since !== null ? {since, seconds: KEY_WAIT_S} : null}>
      <PressIcon />
      <Text style={styles.what}>{c.what}</Text>
      {/*
        * ONE SIZE, CODE OR NOT (Brad, 2026-11-03: yes - the sheet went 196 -> 294 -> 196 px as the login's asks went from a
        * plain press to a code and back, while it stayed open): the code's row is always there - its buttons, or "any
        * button" - with a line above and below it, so the sheet keeps its height whichever the key asks
        */}
      <Text style={styles.note}>{c.digits.length ? 'On your OnlyKey, press these buttons in order:' : 'On your OnlyKey, press:'}</Text>
      <View style={styles.digits}>
        {c.digits.length
          ? c.digits.map((d, i) => <Text key={i} style={styles.digit}>{d}</Text>)
          : <Text style={styles.digit}>any button</Text>}
      </View>
      <Text style={styles.note}>{c.digits.length ? 'A key set to ask for one press takes any button instead.' : 'One press is all the key asks for here.'}</Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  what: {color: theme.text, fontSize: 15, marginBottom: 8},
  note: {color: theme.textDim, fontSize: 13, lineHeight: 18},
  digits: {flexDirection: 'row', gap: 16, justifyContent: 'center', marginVertical: 12},
  digit: {color: theme.text, fontSize: 34, fontWeight: '600', fontFamily: theme.mono},
});

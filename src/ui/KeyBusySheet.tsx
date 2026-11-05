/*
 * WAIT FOR THE KEY (src/keyBusy.ts): over whatever tab is open while the key works - through the WebAuthn tunnel (the
 * web app) or straight to it (the phone's soft key, a USB key) - what it is doing, a bar over the operation's steps, and,
 * over the tunnel, why the browser keeps showing its security-key window. Nothing to
 * tap: it goes away when the key is done. The shared Sheet, so the system bars and the backdrop are its business. The
 * code to enter has its own sheet (HostChallengeSheet), which this one steps aside for.
 */
import React, {useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Sheet} from './Sheet';
import {PressIcon} from './PressIcon';
import {usePressSince} from './SheetCountdown';
import {usePressSound} from './pressSound';
import {theme} from './theme';
import {keyBusy, onKeyBusy, type KeyBusy} from '../keyBusy';
import {hostChallenge, onHostChallenge, type HostChallenge} from '../hostChallenge';
import {hostSheetShows} from './HostChallengeSheet';

export function KeyBusySheet() {
  const [b, setB] = useState<KeyBusy | null>(keyBusy());
  const [c, setC] = useState<HostChallenge | null>(hostChallenge());
  useEffect(() => onKeyBusy(setB), []);
  useEffect(() => onHostChallenge(setC), []);
  /* an Edge request that waits for its press: the key's 25 s along the bottom */
  const pressSince = usePressSince(!!b && b.asks);
  /* and rings, as every press sheet (Brad, 2026-11-01: "also audio") */
  usePressSound(pressSince, 'press');
  /*
   * THE PROGRESS SHEET, SAID WHEN IT SHOWS AND GOES (Brad, 2026-11-02: "the rehearsals should be looking at this as a
   * fail"): the drive's sheet inspector (tools/drive/sheets.js) checks that requests running after a press have it
   */
  /* ...as it really shows: under an action sheet it waits to open (Sheet's layers), and "up" is said only once it opened */
  const [sheetShown, setSheetShown] = useState(false);
  useEffect(() => { if (!b || hostSheetShows(c, b)) setSheetShown(false); }, [b, c]);
  const progressUp = !!b && !hostSheetShows(c, b) && !b.asks && sheetShown;
  const wasUp = React.useRef(false);
  useEffect(() => {
    if (progressUp === wasUp.current) return;
    wasUp.current = progressUp;
    console.log(progressUp ? `[sheet] progress up: ${b?.what ?? ''} - why: ${b?.why.length ? b.why.join(' + ') : '(not named)'}` : '[sheet] progress down');
  }, [progressUp, b]);
  /* a host's press sheet (HostChallengeSheet) is on top while the key waits for its press - the rest is this one's progress (Brad, 2026-11-01) */
  if (!b || hostSheetShows(c, b)) return null;
  /*
   * TWO BARS (Brad, 2026-10-29: "tracking the queue and the individual in 2 progress bars"): the queue - this run's
   * requests answered, of those answered, the one in progress and those waiting behind it (a run asks one after another,
   * so the total grows as it goes) - and the request in progress, by its steps.
   */
  const inProgress = b.done ? 0 : 1;
  const total = Math.max(1, b.opsDone + inProgress + b.waiting);
  const queuePct = Math.min(100, Math.round((100 * b.opsDone) / total));
  const queue = [`${b.opsDone} of ${total} request${total === 1 ? '' : 's'} done`];
  if (b.waiting) queue.push(`${b.waiting} waiting`);
  const pct = Math.min(100, Math.round((100 * b.step) / b.steps));
  /* the step in progress, counted from 1 (the bar fills by the steps done) */
  const step = `This request: step ${b.done ? b.steps : Math.min(b.step + 1, b.steps)} of ${b.steps}`;
  /* what the work is for, first (Brad, 2026-11-03: "why is it working with my key?") - every task running, when they overlap */
  const why = b.why.length === 1 ? b.why[0] : b.why.length > 1 ? `${b.why.length} things: ${b.why.join(' · ')}` : null;
  return (
    <Sheet title={b.asks ? 'Press your OnlyKey' : 'Working with your key'}
      /* its press (a hard key's) is an action; its progress is the layer under every action sheet (Sheet.tsx) */
      layer={b.asks ? 'action' : 'progress'} onShown={setSheetShown} countdown={pressSince !== null ? {since: pressSince, seconds: 25}
      /* the request's own limit while it runs (Brad, 2026-11-01: the sheet sat "just inactive" while a read hung 30 s; "if it has a timer it gets a timer progress bar") */
      : !b.done && b.limitMs ? {since: b.since, seconds: Math.max(1, Math.round(b.limitMs / 1000))} : null}>
      {b.asks ? <PressIcon /> : null}
      {/* two lines kept for it, said or not, so the sheet never changes height as the tasks change (the inspector's "sheet jumps") */}
      <Text style={styles.why} numberOfLines={2}>{why ?? ''}</Text>
      <Text style={styles.counts}>{queue.join(' · ')}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, {width: `${queuePct}%`}]} />
      </View>
      <Text style={[styles.what, styles.gap]} numberOfLines={2}>{b.done ? `${b.what} - done` : b.what}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, styles.fillStep, {width: `${pct}%`}]} />
      </View>
      <Text style={styles.counts}>{step}</Text>
      <Text style={styles.note}>
        {b.asks
          ? `The key is waiting for you: press it to go on.${b.via === 'direct' ? '' : ' The browser window that asks for your security key is part of this step.'}`
          : b.via === 'direct'
            ? 'This app is talking to your OnlyKey. Wait here until it is done.'
            : 'Each step is one security-key window from your browser - that is this app talking to your OnlyKey. Wait here until it is done.'}
      </Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  why: {color: theme.text, fontSize: 16, lineHeight: 22, height: 44, fontWeight: '600', marginBottom: 12},
  /* two lines kept: a long step with " - done" wraps, and the sheet must not grow and shrink with it */
  what: {color: theme.text, fontSize: 16, lineHeight: 22, height: 44, marginBottom: 12},
  track: {height: 8, borderRadius: 4, backgroundColor: theme.border, overflow: 'hidden'},
  fill: {height: 8, borderRadius: 4, backgroundColor: theme.accent},
  counts: {color: theme.textDim, fontSize: 13, marginTop: 8},
  gap: {marginTop: 16},
  fillStep: {backgroundColor: theme.ok},
  note: {color: theme.textDim, fontSize: 13, marginTop: 12, lineHeight: 18},
});

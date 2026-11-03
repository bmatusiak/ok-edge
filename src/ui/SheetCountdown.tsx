/*
 * A WAIT'S TIME LEFT, ALONG THE BOTTOM OF A SHEET (Brad, 2026-10-31: "i like countdown progress bar to be visual at the
 * bottom of the sheet, like the idle check for webapp"). The idle bar's look (src/ui/IdleBar.tsx): a thin line, full
 * width, shrinking from both ends into the centre as the seconds pass - here from `since` over `seconds` (the key's 20 s
 * for a press). Nothing to read, a cue only.
 *
 * MOTION: smooth, except in testing mode (quiet: a step every 5 seconds - the screen tools read a still screen).
 */
import React, {useEffect, useRef, useState} from 'react';
import {Animated, Easing, StyleSheet, View} from 'react-native';
import {useQuietMotion} from './CountdownBar';

const STEP_MS = 5000;

/* when a press began: set when `active` turns on, cleared when it turns off - for a sheet's countdown */
export function usePressSince(active: boolean): number | null {
  const [since, setSince] = useState<number | null>(null);
  useEffect(() => { setSince(active ? Date.now() : null); }, [active]);
  return since;
}

export function SheetCountdown({since, seconds, color}: {since: number; seconds: number; color: string}) {
  const quiet = useQuietMotion();
  const total = seconds * 1000;
  const [now, setNow] = useState(Date.now());
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!quiet) return;
    const t = setInterval(() => setNow(Date.now()), STEP_MS);
    return () => clearInterval(t);
  }, [quiet]);

  const fraction = Math.max(0, Math.min(1, 1 - (now - since) / total));

  /* smooth: from where it is now to nothing, over the time that is left */
  useEffect(() => {
    scale.stopAnimation();
    const left = Math.max(0, since + total - Date.now());
    scale.setValue(left / total);
    if (quiet || !left) return;
    const run = Animated.timing(scale, {toValue: 0, duration: left, easing: Easing.linear, useNativeDriver: false});
    run.start();
    return () => run.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [since, total, quiet]);

  return (
    <View style={styles.track} pointerEvents="none" accessibilityLabel={`${Math.ceil(fraction * seconds)} of ${seconds} seconds left`}>
      {/* scaled about its centre: it shrinks from both ends into the middle */}
      <Animated.View style={[styles.bar, {backgroundColor: color, transform: [{scaleX: quiet ? fraction : scale}]}]} />
    </View>
  );
}

/*
 * THE BAR WITH NO TIMER RUNNING: FULL (Brad, 2026-11-03: "everywhere there is an expire bar, show it, dont hide it, then when
 * its needed use it ... if 0 is empty and 100% is full solid, then when it shown make it 100%"). A bar that came and went
 * with each request's timer changed the sheet's height - the sheet rose and fell. Shown always, full until a timer runs it
 * down, the sheet keeps one size.
 */
export function SheetCountdownFull({color}: {color: string}) {
  return (
    <View style={styles.track} pointerEvents="none" accessibilityLabel="no timer running">
      <View style={[styles.bar, {backgroundColor: color}]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {alignSelf: 'stretch', height: 3, marginTop: 14, backgroundColor: 'transparent'},
  bar: {width: '100%', height: 3, opacity: 0.85},
});

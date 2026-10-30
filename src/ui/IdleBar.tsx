/*
 * THE SESSION'S TIME LEFT (Brad, 2026-10-29: "on the bottom of the app, a thin progress bar for the timer, fixed full
 * width, simply just a visual cue for the expiry of the session for the user"; "can we center it, so it shrinks into the
 * center over time"). The idle timer's 15 minutes (src/idleTimer.ts) as a thin line along the bottom of the app: full
 * after anything is done, green (Brad: "gray is hard to see"), shrinking from both ends into the centre as the minutes
 * pass, yellow while the key is checked at the end. Nothing while the timer is not running (the login screens, the
 * shells it is off on).
 *
 * MOTION: a smooth, continuous shrink - except in testing mode, where nothing moves continuously (quiet: drawn in steps
 * every 15 seconds).
 */
import React, {useEffect, useRef, useState} from 'react';
import {Animated, Easing, StyleSheet, View} from 'react-native';
import {theme} from './theme';
import {IDLE_MS, onIdle} from '../idleTimer';

const STEP_MS = 15000;

export function IdleBar({quiet}: {quiet: boolean}) {
  const smooth = !quiet;
  const [s, setS] = useState<{running: boolean; lastActive: number; checking: boolean}>({running: false, lastActive: Date.now(), checking: false});
  const [now, setNow] = useState(Date.now());
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => onIdle((x) => { setS(x); setNow(Date.now()); }), []);

  /* quiet: a step every 15 seconds */
  useEffect(() => {
    if (!s.running || smooth) return;
    const t = setInterval(() => setNow(Date.now()), STEP_MS);
    return () => clearInterval(t);
  }, [s.running, smooth]);

  const fraction = s.checking ? 1 : Math.max(0, Math.min(1, 1 - (now - s.lastActive) / IDLE_MS));

  /* smooth: from where it is now to nothing, over the time that is left - again after each activity */
  useEffect(() => {
    scale.stopAnimation();
    scale.setValue(fraction);
    if (!s.running || !smooth || s.checking) return;
    const left = Math.max(0, s.lastActive + IDLE_MS - Date.now());
    const run = Animated.timing(scale, {toValue: 0, duration: left, easing: Easing.linear, useNativeDriver: false});
    run.start();
    return () => run.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.running, s.lastActive, s.checking, smooth]);

  if (!s.running) return null;
  return (
    <View style={styles.track} pointerEvents="none" accessibilityLabel={s.checking ? 'checking the key' : `session: ${Math.ceil((fraction * IDLE_MS) / 60000)} of ${Math.round(IDLE_MS / 60000)} minutes left`}>
      {/* scaled about its centre: it shrinks from both ends into the middle */}
      <Animated.View style={[styles.bar, {backgroundColor: s.checking ? theme.warn : theme.ok, transform: [{scaleX: smooth ? scale : fraction}]}]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, backgroundColor: 'transparent'},
  bar: {width: '100%', height: 3, opacity: 0.85},
});

/*
 * THE SESSION'S TIME LEFT (Brad, 2026-10-29: "on the bottom of the app, a thin progress bar for the timer, fixed full
 * width, simply just a visual cue for the expiry of the session for the user"). The idle timer's 15 minutes
 * (src/idleTimer.ts) as a thin line along the bottom of the app: full after anything is done, shorter as the minutes pass,
 * the key's colour while the key is being checked at the end. Drawn in steps every 15 seconds, not a sliding animation -
 * a cue, not motion. Nothing while the timer is not running (the login screens, the shells it is off on).
 */
import React, {useEffect, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {theme} from './theme';
import {IDLE_MS, onIdle} from '../idleTimer';

const STEP_MS = 15000;

export function IdleBar() {
  const [s, setS] = useState<{running: boolean; lastActive: number; checking: boolean}>({running: false, lastActive: Date.now(), checking: false});
  const [now, setNow] = useState(Date.now());
  useEffect(() => onIdle((x) => { setS(x); setNow(Date.now()); }), []);
  useEffect(() => {
    if (!s.running) return;
    const t = setInterval(() => setNow(Date.now()), STEP_MS);
    return () => clearInterval(t);
  }, [s.running]);
  if (!s.running) return null;
  const left = s.checking ? 1 : Math.max(0, Math.min(1, 1 - (now - s.lastActive) / IDLE_MS));
  return (
    <View style={styles.track} pointerEvents="none" accessibilityLabel={s.checking ? 'checking the key' : `session: ${Math.ceil((left * IDLE_MS) / 60000)} of ${Math.round(IDLE_MS / 60000)} minutes left`}>
      <View style={[styles.bar, {width: `${left * 100}%`, backgroundColor: s.checking ? theme.warn : theme.textDim}]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, backgroundColor: 'transparent'},
  bar: {height: 3, opacity: 0.6},
});

/*
 * THE PRESS ICON (Brad, 2026-10-31: "i think i need a animated press icon, using U+261E ☞ and U+25CE ◎, doing this
 * "☞◎" "☞ ◎" alternating centered"): a finger tapping the key's button, wherever the app waits for a press on the
 * key. Still in testing mode on the testnet (useQuietMotion - the driver reads only a screen that has stopped moving).
 */
import React, {useEffect, useState} from 'react';
import {StyleSheet, Text} from 'react-native';
import {theme} from './theme';
import {useQuietMotion} from './CountdownBar';

/* header-sized: twice the body text (Brad: "need to be 2x size then normal font ... header sized") */
export function PressIcon({size = 28}: {size?: number}) {
  const quiet = useQuietMotion();
  const [apart, setApart] = useState(false);
  /*
   * SAID ONCE WHEN IT SHOWS (Brad, 2026-10-31: "the new press icon's animation can help you trigger when to know to
   * press"): the key waits for a press now - the drive presses a test hard key through its debug console on this line
   * (tools/drive/server.js); the soft key's own button stays the app's.
   */
  useEffect(() => {
    console.log(`[press] icon up (${require('../hooks/KeyContext').activeBackend()})`);
  }, []);
  useEffect(() => {
    if (quiet) return;
    const t = setInterval(() => setApart(a => !a), 500);
    return () => clearInterval(t);
  }, [quiet]);
  return (
    <Text accessibilityLabel="Press the key" style={[styles.icon, {fontSize: size}]}>
      {apart ? '☞ ◎' : '☞◎'}
    </Text>
  );
}

const styles = StyleSheet.create({
  icon: {color: theme.text, textAlign: 'center', alignSelf: 'center', marginVertical: 8},
});

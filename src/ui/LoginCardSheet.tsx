/*
 * THE OFFER TO MAKE THIS DEVICE'S LOGIN CARD (src/loginCard.ts): shown after a login that ran manually, once the bucket's
 * first sync found no card for this device. Make it: the key certifies the card at a press (a link on the chain); every
 * later login on this device is one press. Not now: the next login is manual again and asks again.
 */
import React, {useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Btn} from './components';
import {Sheet} from './Sheet';
import {theme} from './theme';
import {DEVICE_WORD} from '../platform';
import {cardOffer, dismissCardOffer, makeCard, onCardOffer, type CardOffer} from '../loginCard';

export function LoginCardSheet() {
  const [o, setO] = useState<CardOffer>(cardOffer());
  useEffect(() => onCardOffer(setO), []);
  if (!o) return null;
  const busy = o.state === 'certifying' || o.state === 'pressing';
  return (
    <Sheet tone="edge" title={`This ${DEVICE_WORD}'s login card`} onClose={busy ? undefined : dismissCardOffer}>
      <Text style={styles.line}>{`This ${DEVICE_WORD}'s key (device ${o.device.slice(0, 8)}…) has no login card yet, so this login asked each request on its own.`}</Text>
      <Text style={styles.dim}>The key certifies the card once - it names this device, your bucket identity and the requests a login makes. After that, logging in here is one press.</Text>
      {o.state === 'pressing' ? <Text style={[styles.line, {color: theme.warn}]}>Press the key to certify the card.</Text> : null}
      {o.state === 'failed' ? <Text style={[styles.line, {color: theme.error}]}>{`Not made: ${o.why}`}</Text> : null}
      <View style={styles.row}>
        <Btn title={o.state === 'failed' ? 'Try again' : 'Make the card'} tone="primary" disabled={busy} onPress={() => { void makeCard(); }} />
        <Btn title="Not now" disabled={busy} onPress={dismissCardOffer} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  line: {color: theme.text, fontSize: 15, marginBottom: 8},
  dim: {color: theme.textDim, fontSize: 13, marginBottom: 12},
  row: {flexDirection: 'row', gap: 12, marginTop: 8},
});

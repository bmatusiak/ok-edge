/*
 * A PRESS THE PERSON CAN TURN OFF (Brad, 2026-10-25: "field 30, so we request a press anyways and it can autopress -
 * we should add a hint around press button for this so a user can skip some presses").
 *
 * The app always asks for the press. The key decides whether it waits for one: a request on slot 128 - a key
 * derived from a label for the web app and local agents, its shared secret or decapsulation (this identity's
 * bucket, the password vault, age) - follows field 30, "Web and agent derived keys" (okcore.cpp
 * okcore_user_input_mode_for_slot). Set to None, the key answers those by itself while it is unlocked. It never
 * changes WHICH key is derived (lib src/device/preferences.js), so nothing already sealed stops opening.
 * The cost is said with it: with no press, anything that reaches the unlocked key can use those keys too.
 * Shown only beside a slot-128 press - signing and stored keys follow other fields, which production refuses
 * to set to None.
 */
import React from 'react';
import {StyleSheet, Text} from 'react-native';
import {theme} from './theme';

/** okcore.h RESERVED_KEY_WEB_AGENT_DERIVATION (lib src/device/slots.js WEB_AGENT_DERIVATION_SLOT) */
export const WEB_AGENT_DERIVATION_SLOT = 128;

export function SkipPressHint() {
  return (
    <Text style={styles.hint}>
      This press can be skipped: Settings › Preferences › User Input Modes › "Web and agent derived keys" › None (the
      key asks for config mode). The key then answers these by itself while it is unlocked - and so can anything else
      that reaches it.
    </Text>
  );
}

const styles = StyleSheet.create({
  hint: {marginTop: 8, color: theme.textDim, fontSize: 12, lineHeight: 17, textAlign: 'center'},
});

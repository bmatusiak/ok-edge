/*
 * THE KEY WENT AWAY: NOTHING OF IT STAYS (Brad, 2026-10-31: "the entire user state depends on identity plugin, a lot
 * should be checking on this, so its important to ensure it sanitary after a unplug").
 *
 * The lib's identity plugin is told first (src/onlykey.ts resetOnlyKey: forget('unplugged')), and the login follows it
 * (MainApp). This clears every other thing the app kept for that key - each a single "the one now" that a replugged
 * key, or another key, would otherwise inherit:
 *   - Edge opened on that key's session (useEdge, edgeAgents): its requests would go to a session that no longer
 *     listens, and wait for good;
 *   - this session's Edge memory per key (heads, public keys), and which device is "this one";
 *   - the key's identity read, the card offer, what the key was waiting on (a code, a press, a derive), the FIDO
 *     channel.
 * The open bucket is sealed and saved, then closed (bucketStore closeBucket), by the login's own clean-up. What is
 * kept per device id (mirrors, logs) stays: it is that device's, and stored sealed.
 */
export function forgetKeyState(): void {
  require('./hooks/useEdge').forgetEdgeKey();
  require('./edgeAgents').forgetAgentsKey();
  require('./edgeSoftKey').SoftKeyEdge.forgetSession();
  require('./edgeDevices').forgetCurrentDevice();
  require('./keyIdentity').forgetKeyIdentity();
  require('./loginCard').dismissCardOffer();
  require('./hostChallenge').clearHostChallenge();
  require('./pressAsk').forgetPressAsk();
  require('./credprovider/flow').dropChannel();
  require('./localMcp').leaveLocalMcp();
}

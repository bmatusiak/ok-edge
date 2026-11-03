/*
 * AFTER THE SHIP THE APP ASKS THE KEY NOTHING (Brad, 2026-11-03: "this kind of thing can't happen, it makes the product
 * unusable" - a 255-sign ship on red-key left the desktop reading the chain head ~2,000 times over 13 min; "the webapp
 * would never be able to handle this kind of operation"). The ship's CLI ends each use holding the key's signed
 * checkpoint and files it with its links; the app takes them against it offline (edgeStore.takeOffline) and its tab only
 * looks (useEdge look). So once the ship has exited, a key request the app begins is a failure - each one is a WebAuthn
 * ceremony on the web app. The wait is a quiet one (drive.waitForLog: every line the app logs starts it again).
 */
const QUIET_S = 30;
const asked = await drive.waitForLog(/\[timeline\] \d+ begin #\d+ /, QUIET_S).then((l) => l, () => null);
if (asked) throw new Error(`the app asked the key after the ship: ${String(asked).replace(/^.*\[timeline\] \d+ /, '')}`);
drive.say(`after the ship: the app asked the key nothing in ${QUIET_S} s of quiet`);

/*
 * NOTHING DONE UNTIL THE KEY LOCKS ITSELF (idle-relogin.yaml): the app must see the key go when it restarts - "[identity]
 * the key went" (src/keyGone.ts). The wait is a quiet one: every line the app logs starts it again, so a busy app keeps
 * the key awake and this fails, which is a finding too (something keeps asking the key).
 */
const MINUTES_N = Math.max(1, parseInt(typeof MINUTES === 'undefined' ? '1' : MINUTES, 10) || 1);
const went = await drive.waitForLog(/\[identity\] the key went/, MINUTES_N * 60 + 90).then((l) => l, (e) => { throw new Error(`the app never saw the key lock and restart itself: ${String(e.message).split('\n')[0]}`); });
drive.say(`the key locked itself and the app saw it go: ${String(went).replace(/^.*\[identity\] /, '')}`);

'use strict';
/*
 * THE SHEET JUDGE (Brad, 2026-11-02: "we need to target finding these issues using rehearsals ... i should not be the one
 * finding these problems, the rehearsals should be looking at this as a fail"; "press sheets and progress during an
 * operation is IMPORTANT at this time, as it signals to the user we know what is going to happen BEFORE it will happen").
 *
 * One per connected app, on every run. It reads the app's own lines - which sheet is up, what the key is asked - and
 * the key's own word where the drive has one (the gadget's LED: plain yellow is an Edge press waiting), and says FAIL
 * when what the person sees does not match what the key does:
 *   no press sheet     the key waits for a press and no press sheet is up within NO_SHEET_MS
 *   stale press sheet  the key answered and the press sheet is still up STALE_MS later, with no new wait
 *   no progress        requests still run NO_PROGRESS_MS after a press and no progress sheet shows
 *   idle press sheet   a press sheet up IDLE_MS with no request in flight and no wait
 *   sheet jumps        a sheet that is up changes height JUMPS times within JUMP_MS (a bar coming and going)
 * The lines it reads: "[press] icon up|down" (src/ui/PressIcon.tsx - on every press sheet, nowhere else), "[sheet]
 * progress up|down" (KeyBusySheet), "[sheet] height N: <title>" (Sheet), "[keybusy] the key waits for its press" and
 * "[keybusy] pressed - the key answers" (src/keyBusy.ts), "[press] key waits: ... - buttons" / "[press] key done"
 * (hostChallenge), "[timeline] <ms> begin|end #N <what>" (debug builds), "[main] [gadget] led #rrggbb" (the gadget).
 *
 * It also tells the drive's presser whether a press sheet is up: the drive never presses a key the person was not asked
 * to press (a press on the LED alone hid every missing sheet until 2026-11-02).
 */

const NO_SHEET_MS = 1000;
const STALE_MS = 1000;
const NO_PROGRESS_MS = 1500;
const IDLE_MS = 5000;
const JUMPS = 3;
const JUMP_MS = 2000;

/* the Edge requests the key answers only after a press, by the app's words for them (src/keyBusy.ts EDGE_WHAT) */
const PRESSED_EDGE = /^Edge: (certifying|opening a budget|resuming a budget|settling what is owed|recording a loss)/;
/* plain yellow - red and green equal and lit, blue dark: the key waits for an Edge press (server.js pressWhenAsked) */
const edgeYellow = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return r === g && r > 0x30 && b < 0x30;
};

/**
 * @param {object} o
 * @param {(why: string) => void} o.fail a sheet failure (said once per occurrence)
 * @param {(ev: {kind: 'press'|'progress'|'none', what: string, at: number}) => void} [o.event] what the person sees, as it changes
 * @param {() => number} [o.now]
 */
function createSheetJudge({ fail, event = () => {}, now = Date.now }) {
  let icons = 0;
  let progress = false;
  let progressWhat = '';
  let waitWhat = null; /* the key waits for a press now: what for */
  let waitsSeen = 0; /* waits begun - a later answer checks that none came after it */
  let ledWaiting = false;
  const open = new Map(); /* timeline id -> what */
  const timers = new Set();
  const heights = new Map(); /* title -> change times */
  let idleTimer = null;
  let pressWhat = '';
  const sheetWaiters = new Set();

  const later = (ms, fn) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
  const seen = () => (icons > 0 ? 'press' : progress ? 'progress' : 'none');
  let lastSeen = 'none';
  function changed() {
    const s = seen();
    if (s !== lastSeen) { lastSeen = s; event({ kind: s, what: s === 'press' ? pressWhat : s === 'progress' ? progressWhat : '', at: now() }); }
    if (icons > 0) for (const w of [...sheetWaiters]) w(true);
    armIdle();
  }
  function armIdle() {
    if (idleTimer) { clearTimeout(idleTimer); timers.delete(idleTimer); idleTimer = null; }
    if (icons > 0 && open.size === 0 && !waitWhat) {
      idleTimer = later(IDLE_MS, () => {
        idleTimer = null;
        if (icons > 0 && open.size === 0 && !waitWhat) fail(`idle press sheet: up ${IDLE_MS / 1000} s with no request to the key and no wait (${pressWhat || 'press sheet'})`);
      });
    }
  }

  function waits(what) {
    if (waitWhat) return;
    waitWhat = what;
    waitsSeen += 1;
    pressWhat = what;
    later(NO_SHEET_MS, () => {
      if (waitWhat === what && icons === 0) fail(`no press sheet: the key waits for a press (${what}) and nothing on screen asks for it after ${NO_SHEET_MS / 1000} s`);
    });
    armIdle();
  }
  function answered(what) {
    if (!waitWhat) return;
    waitWhat = null;
    const n = waitsSeen;
    later(STALE_MS, () => {
      if (icons > 0 && waitsSeen === n && !waitWhat) fail(`stale press sheet: the key answered (${what}) and the press sheet is still up ${STALE_MS / 1000} s later`);
    });
    later(NO_PROGRESS_MS, () => {
      if (open.size > 0 && !progress && icons === 0 && waitsSeen === n) fail(`no progress: ${open.size} request(s) still run ${NO_PROGRESS_MS / 1000} s after the press (${[...open.values()].join(', ')}) and no progress sheet shows`);
    });
    armIdle();
  }

  function line(raw) {
    const l = String(raw);
    if (/^\[press\] icon up/.test(l)) { icons += 1; changed(); return; }
    if (/^\[press\] icon down/.test(l)) { icons = Math.max(0, icons - 1); changed(); return; }
    let m = /^\[sheet\] progress up: ?(.*)$/.exec(l);
    if (m) { progress = true; progressWhat = m[1]; changed(); return; }
    if (/^\[sheet\] progress down/.test(l)) { progress = false; changed(); return; }
    m = /^\[sheet\] height (\d+): (.*)$/.exec(l);
    if (m) {
      const t = now();
      const list = (heights.get(m[2]) || []).filter((x) => t - x < JUMP_MS);
      list.push(t);
      heights.set(m[2], list);
      if (list.length === JUMPS) fail(`sheet jumps: "${m[2]}" changed height ${JUMPS} times within ${JUMP_MS / 1000} s`);
      return;
    }
    m = /^\[keybusy\] the key waits for its press: (.*)$/.exec(l);
    if (m) { waits(m[1]); return; }
    m = /^\[keybusy\] pressed - the key answers: (.*)$/.exec(l);
    if (m) { answered(m[1]); return; }
    m = /^\[press\] key waits: (.*) - buttons /.exec(l);
    if (m) { pressWhat = m[1]; return; }
    m = /^\[timeline\] \d+ (begin|end) #(\d+) (.*?)(?: steps=\d+ (ok|failed.*))?$/.exec(l);
    if (m) {
      if (m[1] === 'begin') { open.set(m[2], m[3]); armIdle(); return; }
      const what = open.get(m[2]) || m[3];
      open.delete(m[2]);
      /* a pressed Edge request that ended: its press is over, answered or not */
      if (PRESSED_EDGE.test(what) && waitWhat) answered(what);
      armIdle();
      return;
    }
    m = /^\[main\] \[gadget\] led (#[0-9a-f]{6})/.exec(l);
    if (m) {
      const y = edgeYellow(m[1]);
      if (y && !ledWaiting) { ledWaiting = true; waits('an Edge press (the key\'s LED)'); }
      else if (!y && ledWaiting) { ledWaiting = false; answered('an Edge press (the key\'s LED)'); }
    }
  }

  return {
    line,
    /** is a press sheet up now - or does one come within ms (the presser asks before it presses) */
    pressSheet(ms = 0) {
      if (icons > 0 || !ms) return Promise.resolve(icons > 0);
      return new Promise((resolve) => {
        const t = setTimeout(() => { sheetWaiters.delete(done); resolve(icons > 0); }, ms);
        const done = (v) => { clearTimeout(t); sheetWaiters.delete(done); resolve(v); };
        sheetWaiters.add(done);
      });
    },
    state: () => ({ seen: seen(), icons, progress, waiting: waitWhat, open: open.size }),
    stop() { for (const t of timers) clearTimeout(t); timers.clear(); for (const w of [...sheetWaiters]) w(false); },
  };
}

module.exports = { createSheetJudge, edgeYellow, NO_SHEET_MS, STALE_MS, NO_PROGRESS_MS, IDLE_MS };

'use strict';
/*
 * THE SHEET INSPECTOR (Brad, 2026-11-02: "we need to target finding these issues using rehearsals ... i should not be the one
 * finding these problems, the rehearsals should be looking at this as a fail"; "press sheets and progress during an
 * operation is IMPORTANT at this time, as it signals to the user we know what is going to happen BEFORE it will happen").
 *
 * One per connected app, on every run. It reads the app's own lines - which sheet is up, and what the LIB asks of the
 * key ("[request] press asked|done", src/requestLog.ts: the lib's okcrypto 'press' / edge.onPress, logged beside the
 * sheets, never through them) - and says FAIL when what the person sees does not match what is asked. Not the key's
 * LED (Brad, 2026-11-02: "hardkey does not tell us the led, and prod release does not also"):
 *   no press sheet     the key waits for a press and no press sheet is up within NO_SHEET_MS
 *   stale press sheet  the key answered and the press sheet is still up STALE_MS later, with no new wait
 *   no progress        requests still run NO_PROGRESS_MS after a press and no progress sheet shows
 *   idle press sheet   a press sheet up IDLE_MS with no request in flight and no wait
 *   no code            the key wants a 3-button code and no sheet shows it within NO_SHEET_MS (a hard key's; the soft
 *                      key's own buttons take its presses)
 *   sheet jumps        a sheet goes back to a height it just left (A -> B -> A) within JUMP_MS - a bar coming and going
 * The lines it reads: "[request] press asked: <what> - code d d d|a press" and "[request] press done: <what> -
 * answered|no answer" (the truth), "[press] icon up|down" (src/ui/PressIcon.tsx - on every press sheet, nowhere else),
 * "[sheet] progress up|down" (KeyBusySheet), "[sheet] height N: <title>" (Sheet), "[timeline] <ms> begin|end #N <what>"
 * (the requests in flight - debug builds).
 *
 * It also tells the drive's presser whether a press sheet is up: the drive never presses a key the person was not asked
 * to press (a press on the LED alone hid every missing sheet until 2026-11-02).
 */

const NO_SHEET_MS = 1000;
const STALE_MS = 1000;
const NO_PROGRESS_MS = 1500;
const IDLE_MS = 5000;
const JUMP_MS = 10000;


/**
 * @param {object} o
 * @param {(why: string) => void} o.fail a sheet failure (said once per occurrence)
 * @param {(ev: {kind: 'press'|'progress'|'none', what: string, at: number}) => void} [o.event] what the person sees, as it changes
 * @param {() => number} [o.now]
 */
function createSheetInspector({ fail, event = () => {}, now = Date.now }) {
  let icons = 0;
  let progress = false;
  let progressWhat = '';
  let waitWhat = null; /* the key waits for a press now: what for */
  let waitsSeen = 0; /* waits begun - a later answer checks that none came after it */
  let iconBackend = null; /* the key a press sheet was last shown for: usb (a hard key), embedded (the soft key) */
  const shownCodes = []; /* the codes sheets showed, with when */
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
    if (/^\[press\] icon up/.test(l)) { icons += 1; iconBackend = (/\((\w+)\)/.exec(l) || [])[1] || iconBackend; changed(); return; }
    if (/^\[press\] icon down/.test(l)) { icons = Math.max(0, icons - 1); changed(); return; }
    let m = /^\[sheet\] progress up: ?(.*)$/.exec(l);
    if (m) { progress = true; progressWhat = m[1]; changed(); return; }
    if (/^\[sheet\] progress down/.test(l)) { progress = false; changed(); return; }
    m = /^\[sheet\] height (\d+): (.*)$/.exec(l);
    if (m) {
      /* back where it was: A -> B -> A within JUMP_MS - a part of the sheet coming and going (the time bar), not new words */
      const t = now();
      const h = Number(m[1]);
      const list = (heights.get(m[2]) || []).filter((x) => t - x.t < JUMP_MS);
      list.push({ t, h });
      heights.set(m[2], list);
      const n = list.length;
      if (n >= 3 && list[n - 1].h === list[n - 3].h && list[n - 2].h !== h) {
        fail(`sheet jumps: "${m[2]}" went ${list[n - 3].h} -> ${list[n - 2].h} -> ${h} px within ${Math.round((t - list[n - 3].t) / 100) / 10} s`);
        heights.set(m[2], []);
      }
      return;
    }
    /* the truth: what the lib asked of the key (src/requestLog.ts) */
    m = /^\[request\] press asked: (.*?)(?: - code ([1-6 ]+)| - a press)$/.exec(l);
    if (m) {
      waits(m[1]);
      /*
       * A CODE THE KEY WANTS IS ON THE SHEET (Brad, 2026-11-02: an agent sign's 5 2 3 reached him only through a terminal):
       * the host sheet says it ("[press] code shows ... - buttons d d d", HostChallengeSheet). Not on the soft key - there
       * the app is the key and its own buttons take the press (PressSheet).
       */
      if (m[2] && iconBackend !== 'embedded') {
        const code = m[2].trim();
        const what = m[1];
        const asked = now();
        later(NO_SHEET_MS, () => {
          /* shown with it - the app's own code can show a moment before the lib's line */
          const seen = shownCodes.some((s) => s.code === code && s.t >= asked - NO_SHEET_MS);
          if (waitWhat === what && !seen) fail(`no code: the key wants ${code} (${what}) and no sheet shows it after ${NO_SHEET_MS / 1000} s`);
        });
      }
      return;
    }
    m = /^\[press\] code shows: .* - buttons ([1-6 ]+)$/.exec(l);
    if (m) { shownCodes.push({ code: m[1].trim(), t: now() }); if (shownCodes.length > 20) shownCodes.shift(); return; }
    m = /^\[request\] press done: (.*) - (answered|no answer)$/.exec(l);
    if (m) { answered(m[1]); return; }
    m = /^\[timeline\] \d+ (begin|end) #(\d+) (.*?)(?: steps=\d+ (ok|failed.*))?$/.exec(l);
    if (m) {
      if (m[1] === 'begin') open.set(m[2], m[3]);
      else open.delete(m[2]);
      armIdle();
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

module.exports = { createSheetInspector, NO_SHEET_MS, STALE_MS, NO_PROGRESS_MS, IDLE_MS };

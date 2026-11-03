/*
 * THE KEY IS BUSY OVER WEBAUTHN (Brad, 2026-10-28: "the ctap security dialog just consumes what's happening ... when
 * a ctap operation is in progress, a sheet needs to be open telling the user to wait for it to be done"; "we should
 * be tracking each ctap operation, the sheet should show a progress bar").
 *
 * Where this app reaches its key through the WebAuthn tunnel (the web app; the desktop on Windows), every step of an
 * operation is a browser ceremony, and the browser puts its own security-key window over the page for each one. The
 * lib reports each operation (okcrypto 'tunnel': begin, plan, a step per ceremony, end); this keeps what KeyBusySheet
 * shows: what the key is doing, its steps, how many operations this run of them has had, and how many wait behind.
 *
 * Shown only when an operation lasts past SHOW_AFTER_MS (a quick one would only flash), and kept up HIDE_AFTER_MS (0.3 s:
 * the gaps between back-to-back requests measured at most 0.13 s, and a sheet up longer takes the next click)
 * after the last one ends, so a run of operations - a sync, an Approve - is one sheet that counts on, not a flicker.
 */
export type KeyBusy = {
  what: string;
  step: number;
  steps: number;
  /* operations in this run of them, this one included */
  ops: number;
  /* operations of this run already answered (the queue bar: done of done + this one + waiting) */
  opsDone: number;
  /* operations queued behind this one */
  waiting: number;
  /* the key waits for its press (an Edge budget opened, resumed or settled; a loss accepted) */
  press: boolean;
  /*
   * ...and has it: the ceremony after the press wait came back (Brad, 2026-11-01: "we send a ctap knowing a button press
   * needs to happen, so we display the sheet for that request - after that, we hide the press sheet, and show the working
   * with key progress sheet"). The rest of the request is its answer being collected - no press is asked any more.
   */
  pressed: boolean;
  /*
   * the key waits for the press NOW: it has the request's last chunk (pressAt) and no press yet (Brad, 2026-11-01: "so we
   * show the progress for the press request call, show the press sheet on the last chunk") - the chunks before it are
   * progress like any other request's, and no press is asked before the key can take it
   */
  asks: boolean;
  /*
   * the key has this request's last chunk and has not answered - for ANY request, Edge's or not (Brad, 2026-11-02, the
   * Windows web app: "the press key does not appear on the last chunk" - a derive's code sheet came up as its request
   * began, and its press reached the key while the chunks still went out, a chunk every 2.4 s there). A code asked for the
   * request in flight shows from here (HostChallengeSheet hostSheetShows).
   */
  delivered: boolean;
  done: boolean;
  /* how the request went: through the WebAuthn tunnel (a browser window a step), or straight to the key (the phone's soft key, a USB key) */
  via: 'tunnel' | 'direct';
  /* when this request began, and how long the key is given to answer it - the sheet counts it down (null: not said) */
  since: number;
  limitMs: number | null;
};
type TunnelEvent = {phase: 'begin' | 'plan' | 'step' | 'answered' | 'end'; id: number; msg: number; slot: number; step: number; steps: number; waiting?: number; ok?: boolean; via?: 'tunnel' | 'direct'; limitMs?: number | null; pressAt?: number; answered?: boolean; error?: string};
/* the request in progress: when it began and its limit (said at its begin) */
let began = {id: -1, at: 0, limitMs: null as number | null};
/*
 * where the request's press wait is: the ceremonies done when the key has the whole request (okcrypto's plan, pressAt) -
 * the next one waits for the press. A request with no plan yet: after its first ceremony, as before.
 */
const pressAtOf = new Map<number, number>();
/* the requests whose press was already said (the lib's answered comes on every step after it) */
const saidPressed = new Set<number>();
/*
 * this app reaches its key through the WebAuthn tunnel (a request came that way): a screen's press ask then waits for the
 * key's own wait (asks) - HostChallengeSheet hostSheetShows
 */
let tunnelSeen = false;
export const viaTunnel = () => tunnelSeen;

const SHOW_AFTER_MS = 250;
/*
 * THE RUN, NOT EACH REQUEST (Brad, 2026-10-29: "it shows and hides each op real quick, when it should also be tracking the
 * queue"): a sync asks its requests one after another, with gaps longer than 0.3 s between them over WebAuthn - a sheet
 * that went away 0.3 s after each one flickered. It stays up while the queue keeps working and goes 1 s after the last
 * answer; a click in that second lands on the sheet, not the page.
 */
const HIDE_AFTER_MS = 1000;
const OKEDGE = 0xf8;
/* the Edge requests by their sub-op (lib edge/plugin SUB), as a person would say them */
const EDGE_WHAT: Record<number, string> = {
  0x01: 'reading the chain head', 0x02: 'reading chain links', 0x03: "reading the key's checkpoint",
  0x04: "reading the key's Edge public key", 0x05: "reading the key's post-quantum public key",
  0x07: 'reading the post-quantum signature', 0x08: 'certifying (press the key)', 0x09: 'proving the chain head',
  0x10: 'opening a budget', 0x11: "naming a budget's identity", 0x12: 'ending a budget', 0x13: 'holding a budget',
  0x14: 'resuming a budget', 0x20: 'filing a receipt', 0x21: 'settling what is owed', 0x22: 'starting a budget use',
  0x34: 'recording a loss',
};
/* the Edge requests the key answers only after a press (lib edge/plugin pressed()) */
const EDGE_PRESSED = new Set([0x08, 0x10, 0x14, 0x21, 0x34]);
const MSG_WHAT: Record<number, string> = {
  0xe4: 'connecting to the key', 0xec: 'reading a public key', 0xed: 'signing', 0xf0: 'decrypting',
  0xf3: 'collecting an answer', 0xfb: "reading the key's allowed site", 0xfc: 'deriving a secret',
};
/* a request in the person's words (src/requestLog.ts says the presses with it) */
export const whatOf = (msg: number, slot: number) =>
  msg === OKEDGE ? `Edge: ${EDGE_WHAT[slot] ?? `request ${slot}`}` : MSG_WHAT[msg] ?? `request 0x${msg.toString(16)}`;

let current: KeyBusy | null = null;
let latest: KeyBusy | null = null;
let inFlight = false;
let ops = 0;
let opsDone = 0;
let showTimer: ReturnType<typeof setTimeout> | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<(b: KeyBusy | null) => void>();

export const keyBusy = () => current;
export function onKeyBusy(l: (b: KeyBusy | null) => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
function set(b: KeyBusy | null) {
  current = b;
  for (const l of [...listeners]) l(b);
}

/*
 * THE TIMELINE (Brad, 2026-10-28: "measure the entire process from start of the webapp login to the end of bucket,
 * see why in-between actions have a huge gap"): debug builds log each operation's begin and end and each wait the
 * lib takes before one, on the wall clock in ms - so the time between two requests can be split into the lib's waits
 * and everything else (the page's own work, the browser). tools/box/timeline.js reads them with the box flow's steps.
 */
const timeline = (text: string) => { if (__DEV__) console.log(`[timeline] ${Date.now()} ${text}`); };
/** okcrypto.on('settle', noteSettle) - the lib waits before a request (the key's last reply, its timers) */
export function noteSettle(e: {ms: number; why?: string}) {
  timeline(`wait ${Math.round(e.ms)} ms: ${e.why ?? ''}`);
}

/** okcrypto.on('tunnel', noteTunnel) - one operation's progress */
/*
 * AN EDGE REQUEST STRAIGHT TO THE KEY (lib edge.onRequest; Brad, 2026-10-29: the phone shows what the key is doing, as
 * the web app does - "a refresh is just a trigger for the operation, the sheet shows what's happening"): the phone's
 * soft key and a key on USB answer Edge without the tunnel, so its own begin and end feed the same sheet. A request
 * that waits for a press on the soft key is left to its own Press button; on a key on USB this sheet asks for it.
 * Edge requests on one key run one at a time (the plugin's lane), so one counter names them.
 */
let edgeOp = 0;
export function noteEdgeRequest(e: {phase: 'begin' | 'end'; sub: number; ok?: boolean; waiting?: number; limitMs?: number}) {
  const pressed = EDGE_PRESSED.has(e.sub);
  /*
   * ONLY THE SOFT KEY HAS ITS OWN PRESS SHEET (2026-11-02, Windows, red-key: the nametag's certify waited 30 s for a press
   * and nothing showed - every pressed Edge request to a key on USB was skipped here, and only a screen that raised its
   * own ask, the login's, had a sheet). A key on USB has the whole request at once: it waits for the press from the
   * begin, so the sheet's press wait (asks) starts there.
   */
  if (pressed && require('./hooks/KeyContext').activeBackend() === 'embedded') return;
  if (e.phase === 'begin') edgeOp += 1;
  const base = {id: edgeOp, msg: OKEDGE, slot: e.sub, ok: e.ok, waiting: e.waiting, via: 'direct' as const, limitMs: e.limitMs ?? null};
  if (e.phase === 'end') { noteTunnel({...base, phase: 'end', step: pressed ? 2 : 1, steps: pressed ? 2 : 1}); return; }
  noteTunnel({...base, phase: 'begin', step: 0, steps: pressed ? 2 : 1});
  if (pressed) noteTunnel({...base, phase: 'step', step: 1, steps: 2, pressAt: 1});
}

/*
 * THE KEY WENT AWAY (Brad, 2026-10-31: "i unplugged the key, but this sheet never closed"): a request in progress ends
 * with no answer - the sheet, the run's counts and its timers go with the key, at once.
 */
export function keyGone() {
  if (showTimer) { clearTimeout(showTimer); showTimer = null; }
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
  inFlight = false;
  ops = 0;
  opsDone = 0;
  latest = null;
  if (current) set(null);
}

export function noteTunnel(e: TunnelEvent) {
  if (e.phase === 'begin') timeline(`begin #${e.id} ${whatOf(e.msg, e.slot)}`);
  if (e.phase === 'end') timeline(`end #${e.id} ${whatOf(e.msg, e.slot)} steps=${e.step} ${e.ok ? 'ok' : `failed${e.error ? ` - ${e.error}` : ''}`}`);
  /* the key answered: activity for the idle timer (src/idleTimer.ts - "if the key is detected as still responding") */
  if (e.phase === 'end' && e.ok) require('./idleTimer').touch('key');
  if (e.phase === 'begin') {
    pressAtOf.clear();
    saidPressed.clear();
    began = {id: e.id, at: Date.now(), limitMs: e.limitMs ?? null};
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    ops += 1;
    inFlight = true;
  }
  if (Number.isInteger(e.pressAt)) pressAtOf.set(e.id, e.pressAt as number);
  const pressAt = pressAtOf.get(e.id) ?? 1;
  const steps = Math.max(e.steps || 1, e.step, 1);
  /*
   * PRESSED IS THE KEY'S ANSWER, NOT A STEP COUNT (2026-11-01: a waiting key answers "not yet" to every poll after the
   * request's last chunk - each poll is a step - so "the step after pressAt" was taken as the press while the key still
   * waited, and the press sheet went for its 26 s): the lib says when a poll first brought the answer (okcrypto answered).
   */
  const isPress = e.msg === OKEDGE && EDGE_PRESSED.has(e.slot);
  const answered = !!e.answered;
  if (e.via !== 'direct') tunnelSeen = true;
  const b: KeyBusy = {
    what: whatOf(e.msg, e.slot), step: e.step, steps, ops, opsDone, waiting: e.waiting ?? 0,
    press: isPress, pressed: isPress && answered,
    asks: isPress && e.phase === 'step' && e.step >= pressAt && !answered,
    /* the plan too: a one-packet request the key asks inside (pressAt one less) waits from the moment it is planned */
    delivered: (e.phase === 'step' || e.phase === 'plan') && e.step >= pressAt && !answered, done: false, via: e.via ?? 'tunnel',
    since: began.id === e.id ? began.at : Date.now(), limitMs: began.id === e.id ? began.limitMs : null,
  };
  if (e.phase === 'end') {
    inFlight = false;
    opsDone += 1;
    if (current) set({...b, step: steps, opsDone, asks: false, delivered: false, done: true});
    hideTimer = setTimeout(() => {
      hideTimer = null;
      if (inFlight) return;
      ops = 0;
      opsDone = 0;
      latest = null;
      set(null);
    }, HIDE_AFTER_MS);
    return;
  }
  latest = b;
  /*
   * THE KEY WAITS FOR ITS PRESS once it has the whole request (pressAt: its request packets sent - okcrypto's plan) -
   * said once per operation in the log, the moment a press can land (before it, a press reaches a key not yet asked:
   * lost, or typed as slot 1; 2026-11-01: a 22-ceremony budget opening was said to wait after its first packet). The
   * drive presses on this line.
   */
  if (b.press && e.phase === 'step' && e.step === pressAt) console.log(`[keybusy] the key waits for its press: ${b.what}`);
  /* and once it has it: the press sheet goes, the progress stays (KeyBusySheet, HostChallengeSheet) */
  /*
   * THE PRESS ASK ENDS WITH IT (Brad, 2026-11-01: "its sending a stream of ctap calls, but not showing the ctap
   * progress"): a screen's ask is raised for its whole operation (the login's bucket open: a budget, a derive, the
   * proof, the rows - one press among dozens of requests), so a sheet hidden only while this request was pressed came
   * back with the next one and covered the progress. The key has its press: nothing waits on the person now.
   */
  if (b.pressed && !saidPressed.has(e.id)) {
    saidPressed.add(e.id);
    console.log(`[keybusy] pressed - the key answers: ${b.what}`);
    require('./hostChallenge').clearHostChallenge();
  }
  if (current) { set(b); return; }
  if (!showTimer) {
    showTimer = setTimeout(() => {
      showTimer = null;
      /*
       * a RUN of requests that lasts, not only one: straight to the key each request is quick (well under SHOW_AFTER_MS on
       * the phone's soft key), but a sync is dozens back to back - still in one (inFlight) or between two (hideTimer)
       */
      if (latest && (inFlight || hideTimer)) set(latest);
    }, SHOW_AFTER_MS);
  }
}

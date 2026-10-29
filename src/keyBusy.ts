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
 * Shown only when an operation lasts past SHOW_AFTER_MS (a quick one would only flash), and kept up HIDE_AFTER_MS
 * after the last one ends, so a run of operations - a sync, an Approve - is one sheet that counts on, not a flicker.
 */
export type KeyBusy = {
  what: string;
  step: number;
  steps: number;
  /* operations in this run of them, this one included */
  ops: number;
  /* operations queued behind this one */
  waiting: number;
  /* the key waits for its press (an Edge budget opened, resumed or settled; a loss accepted) */
  press: boolean;
  done: boolean;
};
type TunnelEvent = {phase: 'begin' | 'plan' | 'step' | 'end'; id: number; msg: number; slot: number; step: number; steps: number; waiting?: number; ok?: boolean};

const SHOW_AFTER_MS = 250;
const HIDE_AFTER_MS = 700;
const OKEDGE = 0xf8;
/* the Edge requests by their sub-op (lib edge/plugin SUB), as a person would say them */
const EDGE_WHAT: Record<number, string> = {
  0x01: 'reading the chain head', 0x02: 'reading chain links', 0x03: "reading the key's checkpoint",
  0x04: "reading the key's Edge public key", 0x05: "reading the key's post-quantum public key",
  0x06: "signing this device's nametag", 0x07: 'reading the post-quantum signature',
  0x10: 'opening a budget', 0x11: "naming a budget's identity", 0x12: 'ending a budget', 0x13: 'holding a budget',
  0x14: 'resuming a budget', 0x20: 'filing a receipt', 0x21: 'settling what is owed', 0x22: 'starting a budget use',
  0x34: 'recording a loss',
};
/* the Edge requests the key answers only after a press (lib edge/plugin pressed()) */
const EDGE_PRESSED = new Set([0x10, 0x14, 0x21, 0x34]);
const MSG_WHAT: Record<number, string> = {
  0xe4: 'connecting to the key', 0xec: 'reading a public key', 0xed: 'signing', 0xf0: 'decrypting',
  0xf3: 'collecting an answer', 0xfb: "reading the key's allowed site", 0xfc: 'deriving a secret',
};
const whatOf = (msg: number, slot: number) =>
  msg === OKEDGE ? `Edge: ${EDGE_WHAT[slot] ?? `request ${slot}`}` : MSG_WHAT[msg] ?? `request 0x${msg.toString(16)}`;

let current: KeyBusy | null = null;
let latest: KeyBusy | null = null;
let inFlight = false;
let ops = 0;
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

/** okcrypto.on('tunnel', noteTunnel) - one operation's progress */
export function noteTunnel(e: TunnelEvent) {
  if (e.phase === 'begin') {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    ops += 1;
    inFlight = true;
  }
  const steps = Math.max(e.steps || 1, e.step, 1);
  const b: KeyBusy = {
    what: whatOf(e.msg, e.slot), step: e.step, steps, ops, waiting: e.waiting ?? 0,
    press: e.msg === OKEDGE && EDGE_PRESSED.has(e.slot), done: false,
  };
  if (e.phase === 'end') {
    inFlight = false;
    if (current) set({...b, step: steps, done: true});
    hideTimer = setTimeout(() => {
      hideTimer = null;
      if (inFlight) return;
      ops = 0;
      latest = null;
      set(null);
    }, HIDE_AFTER_MS);
    return;
  }
  latest = b;
  /*
   * THE KEY WAITS FOR ITS PRESS once the request's first ceremony is done - said once per operation in the log, the
   * moment a press can land (before it, a press reaches a key not yet asked: lost, or typed as slot 1). The box's
   * flow presses on this line (tools/box/webapp-edge-budget.sh).
   */
  if (b.press && e.phase === 'step' && e.step === 1) console.log(`[keybusy] the key waits for its press: ${b.what}`);
  if (current) { set(b); return; }
  if (!showTimer) {
    showTimer = setTimeout(() => {
      showTimer = null;
      if (inFlight && latest) set(latest);
    }, SHOW_AFTER_MS);
  }
}

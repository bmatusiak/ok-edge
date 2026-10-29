/*
 * THE IDLE TIMER (Brad, 2026-10-29: "a 15min idle check on the key is the only 'automatic' call on a timer"; "every app
 * for the idle timer, BUT webapp only for now"; the bar: "a thin progress bar, fixed full width, simply a visual cue for
 * the expiry of the session"). One code path for every shell, switched on in the web app only (ENABLED).
 *
 * Activity (Brad: "if i click on the page, send keystroke to the page, if the key is detected as still responding"):
 * a click or a key typed in the page, and every request the key answers (keyBusy noteTunnel) - each starts the 15
 * minutes again. When they run out with nothing done, the key is asked ONE thing, its site report (okcrypto keySite: a
 * report, no press): it answers - still there and unlocked, the timer starts again; it does not (locked, unplugged,
 * gone) - the person is logged out (logOut.ts). That check is the only request this app makes of the key on a timer.
 *
 * An open Edge budget holds the check off until it ends (setBudgetsOpen, below). Running only while someone is logged in
 * (MainApp: the app's main phase); stopped on the login screens.
 */
import {shell} from './platform';
import {getOnlyKey} from './onlykey';
import {activeBackend} from './hooks/KeyContext';
import {logOut} from './logOut';

declare const document: any;

declare const sessionStorage: any;
/* a development build can be tested in seconds (sessionStorage okedge-idle-ms, read at load); a release is 15 minutes */
const devIdle = (() => { try { return __DEV__ && typeof sessionStorage !== 'undefined' ? Number(sessionStorage.getItem('okedge-idle-ms')) || 0 : 0; } catch { return 0; } })();
export const IDLE_MS = devIdle > 0 ? devIdle : 15 * 60 * 1000;
export const ENABLED = shell === 'webapp';

let running = false;
let lastActive = Date.now();
let timer: ReturnType<typeof setTimeout> | null = null;
let checking = false;
type Listener = (s: {running: boolean; lastActive: number; checking: boolean}) => void;
const listeners = new Set<Listener>();
const tell = () => { for (const l of listeners) l({running, lastActive, checking}); };

/** Something happened (a click, a key typed, the key answering): the 15 minutes start again. */
export function touch(_why: 'input' | 'key'): void {
  if (!running || checking) return;
  lastActive = Date.now();
  tell();
}

function arm(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!running) return;
  const left = lastActive + IDLE_MS - Date.now();
  timer = setTimeout(() => { void expire(); }, Math.max(1000, left));
}

/*
 * AN OPEN EDGE BUDGET HOLDS THE CHECK OFF (Brad, 2026-10-29: "if an edge budget is open, idle check is skipped until the
 * budget is complete or expired"): the app's last read of the key's live budgets (edgeSoftKey budgets), each with when
 * it runs out. While one is open the check waits for the latest of them; one that ended sooner leaves at the next read.
 */
let budgetsUntil = 0;
export function setBudgetsOpen(endsAt: number[]): void {
  budgetsUntil = endsAt.length ? Math.max(...endsAt) : 0;
}

/* the 15 minutes ran out - unless something happened meanwhile (then only the timer moves on) */
async function expire(): Promise<void> {
  timer = null;
  if (!running) return;
  if (Date.now() - lastActive < IDLE_MS) { arm(); return; }
  if (budgetsUntil > Date.now()) {
    console.log(`[idle] ${Math.round(IDLE_MS / 60000)} minute(s) with nothing done - an Edge budget is open: the check waits until it ends (${new Date(budgetsUntil).toLocaleTimeString()})`);
    timer = setTimeout(() => { void expire(); }, budgetsUntil - Date.now() + 1000);
    return;
  }
  checking = true;
  tell();
  let answered = false;
  try {
    const {okcrypto} = await getOnlyKey(activeBackend());
    await (okcrypto as any).keySite({timeoutMs: 15000});
    answered = true;
  } catch (e) {
    console.log(`[idle] ${Math.round(IDLE_MS / 60000)} minute(s) with nothing done, and the key did not answer (${String((e as Error)?.message ?? e)}) - logging out`);
  }
  checking = false;
  if (!running) return;
  if (!answered) { void logOut(); return; }
  console.log(`[idle] ${Math.round(IDLE_MS / 60000)} minute(s) with nothing done - the key still answers: the session goes on`);
  lastActive = Date.now();
  tell();
  arm();
}

/** Start (someone logged in) or stop (the login screens) the timer. */
export function setIdleRunning(on: boolean): void {
  if (!ENABLED || on === running) return;
  running = on;
  lastActive = Date.now();
  arm();
  tell();
}

/** The timer's state, now and on every change - for the bar. */
export function onIdle(l: Listener): () => void {
  listeners.add(l);
  l({running, lastActive, checking});
  return () => { listeners.delete(l); };
}

/* a click or a key typed anywhere in the page (capture: before any control takes it) */
if (ENABLED && typeof document !== 'undefined') {
  document.addEventListener('pointerdown', () => touch('input'), true);
  document.addEventListener('keydown', () => touch('input'), true);
}

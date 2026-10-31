/*
 * THE APP'S END OF A DRIVE (PROPOSAL-drive.md): this app dials the drive server - one server, every host the same
 * (desktop, web app, Android) - and gives it events and takes commands. The app opens no port.
 *
 *   events out:  hello {shell, net}           once a connection is up
 *                log {line, at}                its console lines and (Android) its own logcat, as mayLeave allows
 *                controls {list}               the top layer's controls, on every change (registry.tsx)
 *                screen {text}                 the screen's text, on every change (screen.ts: each shell reads its own)
 *                error {kind, message}         an exception or unhandled rejection, as it happens (the server pictures it)
 *   commands in: tap {label}                   the top layer's enabled control, pressed by calling it
 *                fill {field, value}           a registered text field, by its placeholder
 *                state {}                      controls + screen text now
 *                shot {}                       the app's picture of itself (shot.ts: each shell captures its own)
 *                quit {}                       the app closes itself (quit.ts) - a drive's stop, storage flushed
 *                raise {}                      a test: an unhandled rejection, which must come back as an error event
 *
 * EVENTS, NOT TIMERS (Brad, 2026-10-31): nothing here polls. A dropped connection is dialled again on the app's next
 * change (a control, a log line), never on a clock.
 *
 * GATED FOR DEBUGGING (Brad: "driving is gated for debugging, so production does not use it"): a production build never
 * dials. A debug build dials from its first screen - a restart lands on the login screen, and the drive has to be
 * able to enter testing mode - and says which net it is on as that changes; the server presses only on the testnet.
 */
import {Platform} from 'react-native';
import {driveFlags, driveGate, fillField, liveControls, onDriveChange, setDriveFlag, tapLabel, topLayer} from './registry';
import {onKeyBusy} from '../keyBusy';
import {shell} from '../platform';
import {currentNet, onNet} from '../net';
import {shot} from './shot';
import {quit} from './quit';
import {screenText, watchScreen} from './screen';
import {watchNativeLog} from './nativeLog';
import {watchErrors} from './errors';
import {watchNet} from './net';
import {storedKeys} from './storage';

/*
 * WHAT MAY LEAVE THE APP (memory: the app log carries key bytes - a new sink takes an allowlist, never "every line").
 * On the testnet every line goes: its keys are throwaway, and that is where a drive works. On the live chain only the
 * lines a drive reads, by their prefix - never the firmware's console, raw traffic, or the native log.
 */
const LIVE_PREFIXES = ['[press]', '[edge]', '[card]', '[identity]', '[bucket]', '[room]', '[timeline]', '[softkey]', '[drive]', '[keybusy]', '[bt]', '[ble]', '[applog:info] [ble]', '[sync]', '[site]', '[net]', '[key]'];
const mayLeave = (line: string, native: boolean) =>
  currentNet() === 'test' || (!native && LIVE_PREFIXES.some(p => line.startsWith(p)));

const URL = process.env.EXPO_PUBLIC_OKEDGE_DRIVE_URL || 'ws://127.0.0.1:8790';

let ws: WebSocket | null = null;
let dialling = false;
let started = false;

/* the top layer's controls, whether an overlay is open, and the app's own flags (phase, busy) */
const controlsMsg = () => ({t: 'controls', list: liveControls(), top: topLayer(), flags: driveFlags()});

function send(msg: object): void {
  if (ws && ws.readyState === 1) {
    try { ws.send(JSON.stringify(msg)); } catch { /* the next change dials again */ }
  }
}

/* an error, to the drive: on the live chain its kind only - the message stays on the device (mayLeave's rule) */
function reportError(kind: string, e: unknown): void {
  if (!ws) return;
  const message = e instanceof Error ? (e.stack ?? e.message) : String(e);
  send({t: 'error', kind, message: currentNet() === 'test' ? message.slice(0, 4000) : '(live chain: the message stays on the device)', at: Date.now()});
}

/* the screen's text, read by the shell (screen.ts / screen.android.ts) and sent */
const sendScreen = () => { void screenText().then(text => send({t: 'screen', text})); };

/*
 * THE ONE TIMER, AN INACTIVITY CHECK (Brad: "the only thing for timers allowed is inactivity checking"): while there is
 * no connection, and the app does nothing that would dial (an idle login screen logs nothing), it checks back every
 * 5 s - a drive server or remote that came up has no event this app could hear (2026-10-31: after drive-remote
 * restarted, the idle desktop app never came back). Connected, it does not run; it never touches the key.
 */
let idle: ReturnType<typeof setTimeout> | null = null;
function idleRedial(): void {
  if (idle) return;
  idle = setTimeout(() => { idle = null; if (!ws) dial(); }, 5000);
}

function dial(): void {
  if (dialling || (ws && ws.readyState <= 1)) return;
  dialling = true;
  let sock: WebSocket;
  try { sock = new WebSocket(URL); } catch { dialling = false; return; }
  sock.onopen = () => {
    dialling = false;
    ws = sock;
    send({t: 'hello', shell, net: currentNet(), os: Platform.OS});
    send(controlsMsg());
    sendScreen();
  };
  sock.onclose = () => { dialling = false; if (ws === sock) ws = null; idleRedial(); };
  sock.onerror = () => { dialling = false; idleRedial(); };
  sock.onmessage = (ev: MessageEvent) => {
    let m: any;
    try { m = JSON.parse(String(ev.data)); } catch { return; }
    const reply = (ok: boolean, extra: object = {}) => send({t: 'reply', id: m.id, ok, ...extra});
    if (m.t === 'tap') { const why = tapLabel(String(m.label)); reply(!why, why ? {why} : {}); }
    else if (m.t === 'fill') { const why = fillField(String(m.field), String(m.value ?? '')); reply(!why, why ? {why} : {}); }
    else if (m.t === 'state') void screenText().then(text => reply(true, {controls: liveControls(), text}));
    /* introduce yourself again: a drive server that took over this connection (through a drive-remote) never had the
     * first hello (2026-10-31: a restarted server waited for an app that was connected all along) */
    else if (m.t === 'hello') { send({t: 'hello', shell, net: currentNet(), os: Platform.OS}); send(controlsMsg()); sendScreen(); }
    else if (m.t === 'shot') void shot().then(r => reply('png' in r, r));
    else if (m.t === 'quit') void quit().then(r => reply('ok' in r, r));
    /* the proof of #2 (errors are events): a rejection nothing handles, as a real bug would leave one */
    else if (m.t === 'raise') { reply(true); void Promise.reject(new Error('drive: a test rejection (run.js raise)')); }
    /*
     * #7 health: what the app keeps - each key and its size on the testnet; on the live chain only how many and how
     * much (a key's name can say what is kept). A value is never sent.
     */
    else if (m.t === 'health') {
      void storedKeys().then(
        s => {
          const total = s.keys.reduce((n, k) => n + k.bytes, 0);
          reply(true, currentNet() === 'test' ? {keys: s.keys, databases: s.databases, total} : {count: s.keys.length, total, databases: s.databases.length});
        },
        (e: unknown) => reply(false, {why: String((e as Error)?.message ?? e)}),
      );
    }
    /* the proof of #4 (the network trace): a request to the drive server's own address, which must come back as [net] */
    else if (m.t === 'net-check') { reply(true); void fetch(URL.replace(/^ws/, 'http')).catch(() => {}); }
    else reply(false, {why: `unknown command "${m.t}"`});
  };
}

/** Dial the drive server; called once at app start. Does nothing outside the debugging gate. */
export function startDrive(): void {
  if (started || !driveGate()) return;
  started = true;

  /* every console line, as it is written - the drive's events are the app's own log */
  for (const level of ['log', 'info', 'warn', 'error'] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      original(...args);
      if (ws) {
        const line = args.map(a => (typeof a === 'string' ? a : a instanceof Error ? a.stack ?? a.message : (() => { try { return JSON.stringify(a); } catch { return String(a); } })())).join(' ');
        if (mayLeave(line, false)) send({t: 'log', line, at: Date.now()});
      }
      /*
       * not connected: the app's own activity is the event to dial again on (one attempt in flight) - a restarted
       * server was never found by an idle app that waited for a control change (2026-10-31). Local only; never the key.
       */
      else dial();
    };
  }

  /*
   * ERRORS ARE EVENTS (drive debugging #2): an exception and an unhandled rejection reach the drive as {t: 'error'},
   * heard where each shell hears them (errors.ts: the page's events; errors.android.ts: React Native's exception
   * manager); the server logs it and takes a picture with a log sample, at the moment it happens.
   */
  watchErrors(reportError);

  /* a key request in flight: a drive waits it out before its next move */
  onKeyBusy(b => setDriveFlag('busy', !!b));

  /*
   * EACH KEY REQUEST, ONE LINE (drive debugging #6; memory: don't hammer the key): what it was, how it went (straight
   * to the key, or through the browser's tunnel), how long, and whether it waited for a press - from the app's own
   * keyBusy, when it ends. The server counts them per run.
   */
  const keyStarted = new Map<number, number>();
  onKeyBusy(b => {
    if (!b) return;
    if (!b.done) { if (!keyStarted.has(b.ops)) keyStarted.set(b.ops, Date.now()); return; }
    const t0 = keyStarted.get(b.ops);
    keyStarted.delete(b.ops);
    const line = `[key] ${b.what} via ${b.via}${t0 ? ` in ${Date.now() - t0} ms` : ''}${b.press ? ' (press)' : ''}`;
    if (ws && mayLeave(line, false)) send({t: 'log', line, at: Date.now()});
  });

  /*
   * the controls changed: the screen did too - its text goes with them (2026-10-31, the Pixel: connected before its
   * first screen was drawn, its text stayed empty at the server, and the layout event alone never refreshed it)
   */
  onDriveChange(() => {
    if (ws) { send(controlsMsg()); sendScreen(); }
    else dial();
  });

  /* the screen's text on every change - the page's MutationObserver, Android's layout event - while connected */
  watchScreen(() => { if (ws) sendScreen(); });

  /* the native side's own log (Android: its logcat), marked as such - the testnet only (mayLeave) */
  watchNativeLog(l => { if (ws && mayLeave(l, true)) send({t: 'log', line: `[logcat] ${l}`, at: Date.now()}); });

  /* its requests and sockets (#4, net.ts) - not this connection to the drive */
  watchNet(l => { if (ws && mayLeave(l, false)) send({t: 'log', line: l, at: Date.now()}); }, URL);

  /* the net decides what the server may press (the testnet only): told as it changes */
  onNet(net => send({t: 'net', net}));
  dial();
}

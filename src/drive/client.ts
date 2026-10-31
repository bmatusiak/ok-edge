/*
 * THE APP'S END OF A DRIVE (PROPOSAL-drive.md): this app dials the drive server - one server, every host the same
 * (desktop, web app, Android) - and gives it events and takes commands. The app opens no port.
 *
 *   events out:  hello {shell, net}           once a connection is up
 *                log {line, at}                every console line this app writes (what the box tools read)
 *                controls {list}               the top layer's controls, on every change (registry.tsx)
 *                screen {text}                 the screen's text, on every change (screen.ts: each shell reads its own)
 *   commands in: tap {label}                   the top layer's enabled control, pressed by calling it
 *                fill {field, value}           a registered text field, by its placeholder
 *                state {}                      controls + screen text now
 *                shot {}                       the app's picture of itself (shot.ts: each shell captures its own)
 *                quit {}                       the app closes itself (quit.ts) - a drive's stop, storage flushed
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
      if (ws) send({t: 'log', line: args.map(a => (typeof a === 'string' ? a : a instanceof Error ? a.stack ?? a.message : (() => { try { return JSON.stringify(a); } catch { return String(a); } })())).join(' '), at: Date.now()});
      /*
       * not connected: the app's own activity is the event to dial again on (one attempt in flight) - a restarted
       * server was never found by an idle app that waited for a control change (2026-10-31). Local only; never the key.
       */
      else dial();
    };
  }

  /* a key request in flight: a drive waits it out before its next move */
  onKeyBusy(b => setDriveFlag('busy', !!b));

  onDriveChange(() => {
    if (ws) send(controlsMsg());
    else dial();
  });

  /* the screen's text on every change - the page's MutationObserver, Android's layout event - while connected */
  watchScreen(() => { if (ws) sendScreen(); });

  /* the net decides what the server may press (the testnet only): told as it changes */
  onNet(net => send({t: 'net', net}));
  dial();
}

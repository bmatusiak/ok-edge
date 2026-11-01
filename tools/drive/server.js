'use strict';
/*
 * THE DRIVE SERVER (PROPOSAL-drive.md; Brad, 2026-10-31: "1 server to drive from, 3 things to drive - webapp,
 * desktop, android - the app connects to the drive server, you call the server to run a drive script").
 *
 *   ws /app       an app dials in (src/drive/client.ts): hello {shell, net}, then its events - log lines, its live
 *                 controls, its screen text - and it answers commands (tap, fill, state)
 *   ws /control   a caller (tools/drive/run.js) asks: {t: 'run', script, app, args}; every line of the run streams
 *                 back, and {t: 'end', code}
 *
 * Every line also goes to logs/drive-server.log and to this server's own window: it runs inside the drive app (NW.js,
 * gui/), one instance per host, showing every line as it happens (Brad: "I hate being blind"; "run in nwjs so you're
 * forced to have a single instance gui on the host the drive server runs on").
 *
 * THE RULES, from PROPOSAL-drive.md's table of 2026-10-31's mistakes (numbers there):
 *   taps are calls on a live control the app names, never screen positions (1, 21); events only - no polling, and the
 *   only timers are watchdogs (2, 6, 20); a step prechecks its goal STATE and ends on it, on a failure state newly
 *   shown, or on its watchdog with the last events (8, 12); history is never an event (7); a failed move stops the
 *   script (11); every press sheet is answered whenever it comes, by this server, on the testnet only (13); a run
 *   reads where things stand and goes on from there (22).
 *
 * Started by the drive app (gui/gui.js): node tools/drive/launch.js server [--remote ws://host:8791] [--port 8790]
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const EventEmitter = require('events');
/* ws 7 (what ok-edge has) exports the server as WebSocket.Server; ws 8 as WebSocketServer */
const WS = require('ws');
const WebSocketServer = WS.WebSocketServer || WS.Server;
const { createTargets } = require('./targets');

/* set by start() */
let PORT = 8790;
let REMOTES = [];
/* every line, for the drive app's window */
const bus = new EventEmitter();
const SCRIPTS = path.join(__dirname, 'scripts');
/* the app's pictures of itself, one file each, named by when and why - beside the log */
const SHOTS = path.join(path.dirname(process.env.DRIVE_LOG || path.join(process.env.HOME || process.env.USERPROFILE || '.', 'project/onlykey/logs/drive-server.log')), 'drive-shots');
const LOG = process.env.DRIVE_LOG || path.join(process.env.HOME || process.env.USERPROFILE || '.', 'project/onlykey/logs/drive-server.log');
let logFile = null;

const stamp = () => new Date().toTimeString().slice(0, 8);
/* one line, everywhere it is watched: stdout, the log file, and the callers of the runs that are going */
const watchers = new Set();
/* the last lines, for the log sample a picture asked from the window keeps beside it (shotNow) */
const SAMPLE = 300;
const recent = [];
const keep = (list, l) => { list.push(l); if (list.length > SAMPLE) list.shift(); };
function line(text) {
  const l = `${stamp()} ${text}`;
  keep(recent, l);
  if (logFile) logFile.write(`${l}\n`);
  bus.emit('line', l);
  for (const w of watchers) w(l);
  /* and on the drive-remotes' screens: the machine the apps run on is where Brad watches */
  if (typeof remotes !== 'undefined') for (const r of remotes.values()) if (r.ws.readyState === 1) r.ws.send(JSON.stringify({ t: 'line', line: l }));
}

/* ------------------------------------------------------------------ an app on the other end */

class App extends EventEmitter {
  constructor(ws, hello) {
    super();
    /* its own last log lines, every one (not only during a run) - for a picture's log sample */
    this.recent = [];
    this.ws = ws;
    this.shell = hello.shell;
    this.net = hello.net;
    this.os = hello.os;
    this.controls = [];
    this.top = 0;
    this.flags = {};
    this.text = '';
    this.nextId = 1;
    this.waiting = new Map();
    this.setMaxListeners(100);
  }
  /* a command and its answer; the app answers at once, so its watchdog is short */
  call(msg, lifeMs = 10000) {
    if (!this.ws || this.closed) return Promise.reject(new Error(`${this.shell} is not connected`));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const dog = setTimeout(() => { this.waiting.delete(id); reject(new Error(`WATCHDOG: the app did not answer "${msg.t}" in ${lifeMs / 1000} s`)); }, lifeMs);
      this.waiting.set(id, (r) => { clearTimeout(dog); resolve(r); });
      this.ws.send(JSON.stringify({ ...msg, id }));
    });
  }
  /* a live control (the top layer's, enabled) or a line of the screen's text, exactly */
  has(label) {
    if (this.controls.some((c) => c.label === label && c.enabled)) return true;
    return this.text.split('\n').some((l) => l.trim() === label);
  }
  liveLabels() { return this.controls.filter((c) => c.enabled).map((c) => c.label); }
  /* nothing open over the screen and no key request in flight - as the app itself says (registry flags) */
  settled() { return !this.top && !(this.flags && this.flags.busy); }
}

let apps = new Map(); /* shell -> App: the newest connection of each shell */
/*
 * EVERY CONNECTION, BY ITS MACHINE (2026-11-01: red-key's desktop on Windows and blue-key's on the box, both "desktop" -
 * the newest took the name, and a run for the box would have driven the live key's app). --app <shell>@<machine>
 * picks one: @windows / @local / @here = this machine's, @linux / @box / @remote = a drive-remote's, any other word a
 * part of the remote's host name. A bare shell is the newest, as before.
 */
const everyApp = new Set();
function pickApp(name) {
  if (!name || !String(name).includes('@')) return apps.get(name);
  const [shell, where] = String(name).toLowerCase().split('@');
  const here = ['windows', 'local', 'here'].includes(where);
  const remote = ['linux', 'box', 'remote'].includes(where);
  const hits = [...everyApp].filter((a) => a.shell === shell && !a.closed && (here ? !(a.ws && a.ws.via) : remote ? !!(a.ws && a.ws.via) : String((a.ws && a.ws.via) || '').toLowerCase().includes(where)));
  return hits[hits.length - 1];
}
/* every hello, for a script waiting on an app to come back after a restart */
const hellos = new EventEmitter();

/* THE SESSION PRESSER: every press sheet, whenever it comes, while the app is on the testnet (13) */
function pressWhenAsked(app) {
  let pressing = false;
  const press = async (label, why) => {
    if (pressing) return;
    pressing = true;
    try {
      const r = await app.call({ t: 'tap', label });
      line(r.ok ? `[${app.shell}] pressed: ${why}` : `[${app.shell}] press refused: ${r.why}`);
    } catch (e) { line(`[${app.shell}] press: ${e.message}`); } finally { pressing = false; }
  };
  /*
   * ONE PRESS PER WAIT, on the app's own event: "[press] sheet up: <what>" is logged once, when the key waits and the
   * button is live (src/ui/PressSheet.tsx Locate). Pressing whenever a "Press the soft key" showed pressed again as
   * soon as the request sheet's twin came to the top (three presses for one approval, 2026-10-31).
   * An approval (" - approve") is the script's to give, not this presser's.
   */
  /*
   * A TOUCH THE KEY WAITS FOR, SEEN ON THE KEY (the web app's gadget, through its machine): a browser's WebAuthn request
   * asks the key for a touch ("Insert your security key and touch it") and the app logs nothing of it - the request is
   * the browser's. The key says it: its LED blinks a waiting colour (yellow with green, or blue - 2026-10-31, both seen
   * under that dialog). One touch per key request step - the app's own "[timeline] begin/end" lines mark the steps, so
   * a blink is never pressed twice - and never while the app shows a code to enter ("[press] key waits" until "[press]
   * key done"): a stray 1 there is a wrong digit. Button 1 - any button is a touch. A testnet key only, by its machine.
   */
  let touched = false;
  let codeOpen = false;
  let iconAnswered = false;
  const waiting = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    return (b > 0x40 && b > r && b > g) || (r > 0x30 && g > 0x30 && b < 0x30);
  };
  app.on('log', async (l) => {
    if (/^\[timeline\] \d+ (begin|end) /.test(l)) { touched = false; return; }
    if (/^\[press\] key waits: /.test(l)) { codeOpen = true; return; }
    if (/^\[press\] key done/.test(l)) { codeOpen = false; return; }
    const led = l.match(/^\[main\] \[gadget\] led (#[0-9a-f]{6})/);
    if (!led) return;
    const colour = led[1];
    if (!waiting(colour) || touched || codeOpen || pressing) return;
    touched = true;
    pressing = true;
    try {
      const s = await procFor(app, 'key-state');
      if (!(s.ok && /\btestnet\b/.test(String(s.what)))) { line(`[${app.shell}] its key waits for a touch - not pressed: not a testnet key`); return; }
      const r = await procFor(app, 'press', { buttons: ['1'] });
      line(r.ok ? `[${app.shell}] pressed: ${r.what} - the key waited for a touch (LED ${colour})` : `[${app.shell}] press refused: ${r.why}`);
    } finally { pressing = false; }
  });
  app.on('log', async (l) => {
    /*
     * A KEY OUTSIDE THE APP WAITS (src/hostChallenge.ts - the web app's key, a hard key): pressed by the machine that
     * holds it (targets.js press), its buttons as the app shows them - one wait, one press. A testnet key only: the
     * app on the testnet, or the key's machine naming it a testnet one (a web app says "live" until it has read its key).
     * The web app's Edge requests that wait for a press say it their own way - "[keybusy] the key waits for its press:
     * <what>" (keyBusy; 2026-10-31: the login card's certify waited out its 26 s) - one press, any button: the same
     */
    const edgeWait = app.shell === 'webapp' && l.match(/^\[keybusy\] the key waits for its press: (.*)$/);
    /*
     * THE PRESS ICON IS UP (Brad, 2026-10-31: "the new press icon's animation can help you trigger when to know to press
     * when that displays"): src/ui/PressIcon.tsx says it once when it shows - a hard key's ("usb") is pressed, button 1,
     * unless a code is being entered (its own "key waits" line has the buttons). The soft key's own button is the app's.
     */
    const icon = l.match(/^\[press\] icon up \(usb\)(?:: (.*))?$/);
    /* one icon press per key request: two sheets showing the icon for one wait must not press twice - a stray press on an
       unlocked key types a slot. The app's next request step ("[timeline] begin/end") opens it again. */
    if (/^\[timeline\] \d+ (begin|end) /.test(l)) { iconAnswered = false; return; }
    if (icon && (codeOpen || iconAnswered)) return;
    if (icon) iconAnswered = true;
    const outside = l.match(/^\[press\] key waits: (.*) - buttons (.*)$/) || (edgeWait && [l, edgeWait[1], 'any']) || (icon && [l, icon[1] || 'the press icon', 'any']);
    if (outside) {
      if (pressing) return;
      pressing = true;
      try {
        /* a testnet key, or a hard key whose DEBUG console answers - a test hex; a production key has none and is never pressed */
        /*
         * A HARD KEY IS PRESSED ONLY WHEN THE APP SAYS ITS CONSOLE ANSWERS (2026-11-01: red-key, a production key, was
         * sent console presses during Brad's login - the machine's listing showed a console interface, which a production
         * key also has; its firmware just never reads it). The app's own probe (useHardKey consoleAnswers: an inert byte
         * echoed back - only a DEBUG build echoes) is the test hex's proof; without it nothing is pressed.
         */
        if (app.net !== 'test') {
          if (app.flags.consoleAnswers !== true) { line(`[${app.shell}] not pressed: the app does not say its key's debug console answers (a production key, or not probed)`); return; }
          const s = await procFor(app, 'key-state');
          if (!(s.ok && /\btestnet\b|debug console answers/.test(String(s.what)))) { line(`[${app.shell}] not pressed: not a testnet key or a test hex (${s.ok ? s.what : s.why})`); return; }
        }
        const buttons = outside[2] === 'any' ? ['1'] : outside[2].split(' ');
        const r = await procFor(app, 'press', { buttons });
        line(r.ok ? `[${app.shell}] pressed: ${r.what} - ${outside[1]}` : `[${app.shell}] press refused: ${r.why}`);
      } finally { pressing = false; }
      return;
    }
    if (app.net !== 'test') return;
    const up = l.match(/^\[press\] sheet up: (.*) - button at /);
    if (!up || / - approve$/.test(up[1])) return;
    const code = up[1].match(/^derive code ([1-6]) ([1-6]) ([1-6])$/);
    if (code) { for (const d of code.slice(1, 4)) await press(d, `the derive code's ${d}`); return; }
    await press('Press the soft key', up[1]);
  });
}

/* ------------------------------------------------------------------ the script's API */

/*
 * A PICTURE, ASKED OF THE APP (Brad, 2026-10-31: "have the app do it, not the drive server"; "trigger screenshots on an
 * event - on an error or when you want"): the app captures itself (src/drive/shot.ts) and this saves it. A run takes
 * one by itself when it stops; a script takes one with d.shot(name). -> the file, or null with the reason logged.
 */
async function shotOf(app, name) {
  try {
    const r = await app.call({ t: 'shot' }, 20000);
    if (!r.ok) { line(`[${app.shell}] no picture (${name}): ${r.why}`); return null; }
    fs.mkdirSync(SHOTS, { recursive: true });
    const file = path.join(SHOTS, `${new Date().toTimeString().slice(0, 8).replace(/:/g, '')}-${app.shell}-${String(name).replace(/[^a-z0-9-]/gi, '_')}.png`);
    fs.writeFileSync(file, Buffer.from(r.png, 'base64'));
    line(`[${app.shell}] picture: ${file}`);
    bus.emit('shot', file, app.shell);
    /* the web app's browser window too, from its machine: Chrome's own dialogs are not the page's (targets.js windowShot) */
    if (app.shell === 'webapp') {
      const w = await proc('window-shot', 'webapp');
      if (w.ok) {
        const wfile = file.replace(/\.png$/, '-window.png');
        fs.writeFileSync(wfile, Buffer.from(w.what, 'base64'));
        line(`[${app.shell}] its browser window: ${wfile}`);
        bus.emit('shot', wfile, app.shell);
      } else line(`[${app.shell}] no picture of its browser window: ${w.why}`);
    }
    return file;
  } catch (e) { line(`[${app.shell}] no picture (${name}): ${e.message}`); return null; }
}

/*
 * A PICTURE WHEN BRAD SEES SOMETHING (Brad, 2026-10-31: "needs a button so i can trigger a snapshot, so if i see
 * something you can see it when i see it while you're moving"): the drive window's button - here, or on a remote's
 * window - asks for a picture now, named for who asked, and logged with the time. From an app's tab (Brad: "each
 * connected app is a tab, so logs can be separated, and the per-app picture button solves itself") only that app
 * (shell); from the drive's own tab, or a remote's window, every connected app.
 */
async function shotNow(by, shell) {
  const targets = [...apps.values()].filter((a) => !shell || a.shell === shell);
  /* by: the window that asked ('host', a remote's machine) - or 'error', the app's own error (#2) */
  const why = by === 'error' ? 'a picture on an error' : `picture asked from the ${by} window`;
  line(`${why}${shell ? ` (${shell})` : ''}`);
  /*
   * and a sample of the log with it (Brad: "the picture now should take a sample of the log"): the drive's last lines
   * and each app's own, up to this moment - written before the pictures are asked, so it is the moment he pressed
   */
  fs.mkdirSync(SHOTS, { recursive: true });
  const tag = `${String(by).replace(/[^a-z0-9-]/gi, '_')}${shell ? `-${shell}` : ''}`;
  const file = path.join(SHOTS, `${stamp().replace(/:/g, '')}-seen-by-${tag}.log`);
  const parts = [`== ${why}${shell ? ` (${shell})` : ''} at ${new Date().toISOString()}`, '', `== the drive (last ${recent.length} lines)`, ...recent];
  for (const a of targets) parts.push('', `== ${a.shell}'s own log (last ${a.recent.length} lines)`, ...a.recent);
  fs.writeFileSync(file, `${parts.join('\n')}\n`);
  line(`log sample: ${file}`);
  bus.emit('sample', file, shell);
  if (!targets.length) { line(`${shell ? `${shell} is not connected` : 'no app connected'} - no picture`); return []; }
  return Promise.all(targets.map((a) => shotOf(a, `seen-by-${by}`)));
}

/* an app's kept lines, for its tab when the window opens it */
const recentOf = (shell) => (apps.get(shell) ? apps.get(shell).recent.slice() : []);

function driveFor(app, say) {
  const lastLines = [];
  const remember = (l) => { lastLines.push(l); if (lastLines.length > 8) lastLines.shift(); };
  app.on('log', remember);
  const failure = (why) => new Error(`${why}\n  last lines:\n${lastLines.map((l) => `    ${l.slice(0, 160)}`).join('\n')}\n  live now: ${app.liveLabels().join(' | ')}`);

  /*
   * until(goal): a label / text line (string), a log line (RegExp), or a test of the app (function). Prechecked
   * against the state now; then only events from now on (7). fail: labels that end it as failed when they newly show.
   * life is a QUIET time (box, 2026-10-31: a fresh browser warming Edge up read the chain for 35 s, and a 30 s wait for
   * the budget button gave up 5 s before it came): every line the app logs starts it again, up to five lives in all.
   */
  function until(goal, { life = 60, fail = ['Try again'] } = {}) {
    const test = typeof goal === 'function' ? () => goal(app) : typeof goal === 'string' ? () => app.has(goal) : null;
    if (test && test()) return Promise.resolve('already');
    const failing = new Set(fail.filter((f) => app.has(f))); /* already showing: only a NEW showing fails */
    return new Promise((resolve, reject) => {
      const off = () => { clearTimeout(dog); app.off('log', onLog); app.off('controls', onState); app.off('screen', onState); app.off('close', onClose); };
      const cap = Date.now() + 5 * life * 1000;
      const bark = () => { off(); reject(failure(`WATCHDOG: no "${goal}" in ${life} s of quiet (${Math.round((Date.now() - cap) / 1000) + 5 * life} s in all)`)); };
      let dog = setTimeout(bark, life * 1000);
      const onLog = (l) => {
        if (goal instanceof RegExp && goal.test(l)) { off(); resolve(l); return; }
        clearTimeout(dog);
        dog = setTimeout(bark, Math.max(0, Math.min(life * 1000, cap - Date.now())));
      };
      const onState = () => {
        if (test && test()) { off(); resolve('now'); return; }
        for (const f of fail) {
          if (!app.has(f)) failing.delete(f);
          else if (!failing.has(f)) { off(); reject(failure(`FAILED: the app shows "${f}"`)); return; }
        }
      };
      const onClose = () => { off(); reject(failure('the app disconnected')); };
      app.on('log', onLog); app.on('controls', onState); app.on('screen', onState); app.on('close', onClose);
    });
  }

  /* tap: wait (by events) until the control is live, then call it; a refusal stops the script (11) */
  /*
   * tap(label): the control live, then the app's own tap. "Covered" or "disabled" from the app means this server's copy
   * of the controls was a moment old - an overlay opened as the tap went out (2026-10-31, the Pixel: "Approve" is
   * covered) - so it waits for the app's next controls and tries again, within the same watchdog.
   */
  async function tap(label, { life = 30 } = {}) {
    const end = Date.now() + life * 1000;
    for (;;) {
      const left = Math.max(1, Math.round((end - Date.now()) / 1000));
      await until(() => app.controls.some((c) => c.label === label && c.enabled), { life: left, fail: [] })
        .catch((e) => { throw failure(`"${label}" never became live: ${e.message.split('\n')[0]}`); });
      const r = await app.call({ t: 'tap', label });
      if (r.ok) break;
      if (!/is (covered|disabled)/.test(String(r.why)) || Date.now() >= end) throw failure(`tap "${label}": ${r.why}`);
      say(`"${label}" ${String(r.why).replace(/^"[^"]*" /, '')} - waiting for the app's next controls`);
      await new Promise((resolve) => {
        const dog = setTimeout(done, Math.max(0, end - Date.now()));
        function done() { clearTimeout(dog); app.off('controls', done); app.off('close', done); resolve(); }
        app.once('controls', done); app.once('close', done);
      });
      if (app.closed) throw failure(`tap "${label}": the app went`);
    }
    say(`tapped "${label}"`);
  }

  async function fill(field, value, { secret = false } = {}) {
    const r = await app.call({ t: 'fill', field, value });
    if (!r.ok) throw failure(`fill "${field}": ${r.why}`);
    say(`filled "${field}"${secret ? ` (${value.length} chars, not logged)` : `: ${value}`}`);
  }
  /* a secret from a file on THIS machine (19): only its length is ever logged */
  async function fillFile(field, file, jsonKey = null) {
    /*
     * THE SECRET STAYS ON ITS MACHINE: an app behind a drive-remote is filled by that remote, from the file there -
     * this server never holds the value, only the app's answer (the box's test backup never crosses to Windows)
     */
    if (app.ws && app.ws.remote) {
      const id = app.nextId++;
      const reply = new Promise((resolve, reject) => {
        const dog = setTimeout(() => { app.waiting.delete(id); reject(failure(`WATCHDOG: no answer to the fill of "${field}" in 20 s`)); }, 20000);
        app.waiting.set(id, (m) => { clearTimeout(dog); resolve(m); });
      });
      app.ws.remote.send(JSON.stringify({ t: 'fill-file', cid: app.ws.cid, id, field, file, key: jsonKey }));
      const r = await reply;
      if (!r.ok) throw failure(`fill "${field}" from ${file} on ${app.ws.via}: ${r.why}`);
      say(`filled "${field}" from ${file} on ${app.ws.via} (not seen here)`);
      return;
    }
    let v = fs.readFileSync(file, 'utf8');
    if (jsonKey) v = JSON.parse(v)[jsonKey];
    if (typeof v !== 'string' || !v) throw new Error(`nothing to fill from ${file}`);
    await fill(field, v, { secret: true });
  }

  /* step: precheck the goal, act, end on the goal / a failure / the watchdog (8, 12, 6) */
  async function step(name, { goal, act, life = 90, fail }) {
    if (typeof goal === 'string' && app.has(goal)) { say(`${name}: already "${goal}"`); return; }
    say(`${name}`);
    const done = until(goal, { life, fail });
    done.catch(() => {}); /* awaited below; a failure during act is not unhandled */
    if (act) await act();
    await done;
    say(`${name}: done`);
  }

  /* goto: the tab, reading the menu first (14) */
  /* goto: the menu read first, the tab tapped, and the app's own word that it shows that tab (its flag) */
  async function goto(tab) {
    if (!app.has('Close menu')) await tap('Menu');
    await tap(tab);
    await until((a) => a.flags.tab === tab && !a.has('Close menu'), { life: 15, fail: [] });
  }

  /*
   * restarted(act): the app restarts (a tap on "Restart the app", a wipe) and dials again - its new connection is a
   * new handle; this one is done. -> the new drive. The hello is the event; the watchdog is its life.
   */
  async function restarted(act, { life = 90 } = {}) {
    const back = new Promise((resolve, reject) => {
      const dog = setTimeout(() => { hellos.off('hello', onHello); reject(failure(`WATCHDOG: ${app.shell} did not come back in ${life} s`)); }, life * 1000);
      const onHello = (a) => { if (a.shell === app.shell && a !== app) { clearTimeout(dog); hellos.off('hello', onHello); resolve(a); } };
      hellos.on('hello', onHello);
      /* waiting with nothing to set off (a page that reloaded itself): a newer connection already up is the one */
      const now = apps.get(app.shell);
      if (!act && now && now !== app && now.ready && !now.closed) onHello(now);
    });
    back.catch(() => {});
    /* the restart a flow sets off (a "Restart the app" tap) is a going it asked for */
    expectGone(app.shell);
    if (act) await act();
    const next = await back;
    /* back: from here a going is not asked for (a start set the mark with no old app to use it up) */
    expected.delete(app.shell);
    app.off('log', remember);
    say(`${next.shell} is back (${next.net})`);
    return driveFor(next, say);
  }

  /*
   * THE TARGET'S PROCESS (Brad, 2026-10-31: "drive script can also start/stop/restart webapp/desktop/android on its
   * expected target"): run on the drive-remote that has it, or on this machine (proc). start and restart end on the
   * app's hello - its own event - and hand back the drive for that new connection; stop ends on its close.
   */
  async function procOrThrow(action, target) {
    if (action === 'stop' || action === 'restart') expectGone(target);
    const r = await proc(action, target);
    if (!r.ok) throw failure(`${action} ${target} (${r.where}): ${r.why}`);
    say(`${action} ${target} on ${r.where}: ${r.what}`);
  }
  /*
   * THE APP CLOSES ITSELF FIRST (2026-10-31: a restart that killed the app's processes lost what Chromium had not
   * flushed - its copy of its own chain): asked to quit (src/drive/quit.ts), it goes, and its connection closing is
   * the event. The target's stop after it ends whatever is left (its watchdog: 20 s).
   */
  async function quitApp() {
    if (app.closed || !app.ws) return;
    expectGone(app.shell);
    const gone = new Promise((resolve) => app.once('close', resolve));
    const r = await app.call({ t: 'quit' }).catch((e) => ({ ok: false, why: e.message }));
    if (!r.ok) { say(`quit: ${r.why} - stopped from outside`); return; }
    say(`${app.shell} asked to close itself`);
    await Promise.race([gone, new Promise((resolve) => setTimeout(resolve, 20000))]);
  }
  const start = (target = app.shell, opts) => restarted(() => procOrThrow('start', target), opts);
  const restart = (target = app.shell, opts) => restarted(async () => { if (target === app.shell) await quitApp(); await procOrThrow('restart', target); }, opts);
  async function stop(target = app.shell) {
    if (target === app.shell) await quitApp();
    await procOrThrow('stop', target);
  }
  /* the app up: as it is when connected, else started */
  const up = (opts) => (app.ws && !app.closed ? Promise.resolve(api) : start(app.shell, opts));

  /* a target's machine, asked directly (#7 health, #1 last words): proc's answer, {ok, what, where} */
  /* the app's own target is asked on the app's own machine (procFor); another target, where it is */
  const machine = (action, target = app.shell, args = {}) => (target === app.shell && app.ws ? procFor(app, action, args) : proc(action, target, args));
  /* every machine at once - this one and each connected remote (run.js doctor) */
  const everywhere = (action, args = {}) => procAll(action, args);
  const api = { app, say, until, tap, fill, fillFile, step, goto, restarted, start, stop, restart, up, machine, everywhere, has: (l) => app.has(l), shot: (name) => shotOf(app, name) };
  return api;
}

/* ------------------------------------------------------------------ the server */

const server = http.createServer((req, res) => {
  /* the server's state as JSON - launch.js waits on it: up, and its remotes connected */
  if (req.url === '/status') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(status())); return; }
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end(`drive server: ${[...apps.values()].map((a) => `${a.shell} (${a.net})`).join(', ') || 'no app connected'}\n`);
});
const wss = new WebSocketServer({ server });

/*
 * AN APP'S CONNECTION, wherever it comes from - a socket of this machine, or one a drive-remote relays from its own
 * (remote.js). sock: an EventEmitter of 'message' and 'close', with send(text). The first message is its hello.
 */
function attachApp(sock) {
  let app = null;
  sock.on('message', (data) => {
    let m;
    try { m = JSON.parse(String(data)); } catch { return; }
    if (!app) {
      if (m.t !== 'hello') return;
      app = new App(sock, m);
      return;
    }
    /*
     * CONNECTED = ITS STATE IS HERE: the hello is followed at once by its controls and its screen (client.ts), and the
     * app counts as connected only on that screen - a script that started on the hello alone prechecked an empty
     * control list and went for a Menu that was not there (2026-10-31).
     */
    if (!app.ready && m.t === 'screen') {
      app.text = String(m.text || '');
      app.ready = true;
      apps.set(app.shell, app);
      everyApp.add(app);
      /* what its process said while it started (#3) begins its record */
      if (outBefore.has(app.shell)) { app.recent.unshift(...outBefore.get(app.shell)); outBefore.delete(app.shell); }
      pressWhenAsked(app);
      line(`app connected: ${app.shell} (${app.os}, ${app.net})${sock.via ? ` via ${sock.via}` : ''}`);
      hellos.emit('hello', app);
      return;
    }
    if (m.t === 'net') { app.net = String(m.net); line(`[${app.shell}] net: ${app.net}`); app.emit('screen'); return; }
    if (m.t === 'reply') { const w = app.waiting.get(m.id); if (w) { app.waiting.delete(m.id); w(m); } return; }
    /* the app says it reloads itself (a newer build): its going is expected */
    if (m.t === 'log' && /^\[web\] reloading/.test(String(m.line))) expectGone(app.shell);
    if (m.t === 'log') { const l = `${stamp()} ${m.line}`; keep(app.recent, l); bus.emit('app-line', app.shell, l); app.emit('log', String(m.line)); return; }
    /*
     * AN ERROR IN THE APP (drive debugging #2): logged in its tab, the whole message kept in its lines, and a picture
     * with a log sample at once - one per burst: none is asked while one is on its way (an event, not a clock)
     */
    if (m.t === 'error') {
      const msg = String(m.message || '').split('\n');
      line(`[${app.shell}] ERROR ${m.kind}: ${msg[0].slice(0, 200)}`);
      for (const l of msg.slice(0, 40)) { const s = `${stamp()} [ERROR ${m.kind}] ${l}`; keep(app.recent, s); bus.emit('app-line', app.shell, s); }
      app.emit('error-event', m);
      if (!app.picturing) { app.picturing = true; shotNow('error', app.shell).finally(() => { app.picturing = false; }); }
      return;
    }
    if (m.t === 'controls') { app.controls = m.list || []; app.top = m.top || 0; app.layers = m.layers || []; app.flags = m.flags || {}; app.emit('controls'); return; }
    if (m.t === 'screen') { app.text = String(m.text || ''); app.emit('screen'); }
  });
  sock.on('close', () => {
    if (!app) return;
    if (apps.get(app.shell) === app) apps.delete(app.shell);
    everyApp.delete(app);
    line(`app gone: ${app.shell}`);
    app.closed = true;
    app.emit('close');
    /* not asked by a drive, and not its remote's link dropping: ask the machine it ran on why (lastWordsOf) */
    const asked = expected.get(app.shell) > Date.now();
    expected.delete(app.shell);
    if (sock.remoteGone) line(`[${app.shell}] its drive-remote's link went - the app may still be running`);
    /* a newer connection of the same app is already up: the page moved (a navigation, a new tab) - nothing died */
    else if (apps.get(app.shell) && apps.get(app.shell) !== app) { /* replaced */ }
    else if (!asked) void lastWordsOf(app);
  });
}

/*
 * GONE WITHOUT BEING ASKED (drive debugging #1, Brad 2026-10-31): a drive's quit, stop or restart - and a flow's
 * awaited restart - mark the app as expected to go (expectGone, 2 minutes); any other "app gone" asks the target's
 * machine for its last words (targets.js: Android's exit record and crash buffer, a desktop process's exit and output)
 * and keeps them beside the pictures with its last screen, its live controls and its last 300 lines. No picture: a
 * gone app cannot be asked for one - its last screen text stands in.
 */
const expected = new Map(); /* shell -> until when its going is expected */
const expectGone = (shell) => expected.set(shell, Date.now() + 120000);
async function lastWordsOf(app) {
  line(`[${app.shell}] gone - not asked by the drive: asking for its last words`);
  const r = await proc('last-words', app.shell);
  const words = r.ok ? String(r.what) : `(no last words: ${r.why})`;
  fs.mkdirSync(SHOTS, { recursive: true });
  const file = path.join(SHOTS, `${stamp().replace(/:/g, '')}-gone-${app.shell}.log`);
  fs.writeFileSync(file, [
    `== ${app.shell} went at ${new Date().toISOString()}, not asked by the drive (${r.where || '?'})`, '', words, '',
    '== its last screen', app.text || '(none)', '',
    '== its live controls', app.liveLabels().join(' | ') || '(none)', '',
    `== its last lines (${app.recent.length})`, ...app.recent, '',
  ].join('\n'));
  for (const l of words.split('\n').filter((x) => /reason|description|exited|still running|FATAL|signal|Exception/i.test(x)).slice(0, 6)) bus.emit('app-line', app.shell, `${stamp()} [last words] ${l.trim()}`);
  line(`[${app.shell}] last words: ${file}`);
  bus.emit('sample', file, app.shell);
}

wss.on('connection', (ws, req) => {
  if (req.url === '/control') return control(ws);
  attachApp(ws);
});

/*
 * DRIVE-REMOTES (remote.js): this server dials each one given (--remote ws://host:8791), with the shared token - the
 * remote's machine needs an open port, this one none. Its apps arrive relayed; its targets are started, stopped and
 * restarted there. A remote that went is dialled again when the next run starts.
 */
const TOKEN = (process.env.DRIVE_TOKEN || (() => { try { return fs.readFileSync(path.join(require('os').homedir(), '.onlykey-drive-token'), 'utf8'); } catch { return ''; } })()).trim();
const remotes = new Map(); /* url -> {ws, machine, targets, waiting} */
const localTargets = createTargets((l) => line(l), (shell, l) => appOut(shell, l), (name, ev) => cmdEvent('this machine', name, ev));

/*
 * A TARGET'S OWN OUTPUT (drive debugging #3) - the desktop's main process (the soft key host, IPC), the web app's
 * browser - into that app's tab as "[main]" lines. The app's rule for what may leave it (src/drive/client.ts mayLeave)
 * holds here too: on the testnet every line; otherwise - the live chain, or the app not connected yet - only a drive's
 * prefixes.
 */
const LIVE_PREFIXES = ['[press]', '[edge]', '[card]', '[identity]', '[bucket]', '[room]', '[timeline]', '[softkey]', '[drive]', '[keybusy]', '[bt]', '[ble]', '[sync]', '[site]', '[hosting]', '[net]', '[gadget]'];
/*
 * A COMMAND ON A MACHINE (a build, the lib's CLI - targets.js streamIn), for the drive window's command tabs (bus
 * 'cmd'): its start and its end are drive lines too, so a run's record and the drive tab say what ran and how it ended.
 * Its output is a debug build's, or the CLI against a testnet key - nothing the live chain says.
 */
function cmdEvent(machine, name, ev) {
  if (ev.t === 'start') line(`[${name}] $ ${ev.cmd} (${machine})`);
  if (ev.t === 'end') line(`[${name}] exit ${ev.code}${ev.code === 0 ? '' : ' - failed'}`);
  bus.emit('cmd', name, ev, machine);
}

/*
 * THE KEYS ON EACH MACHINE (targets.js watchKeys - a remote's, and this machine's own): each change a drive line and a
 * 'keys' event for the window; the apps' own soft keys are in their flags (status). null = not watched on that OS yet.
 */
let localKeys = null;
const keyWords = (keys) => (keys === null ? 'not watched there yet' : keys.length ? keys.map((k) => `${k.kind} (usb ${k.usb}${k.serial ? `, serial ${k.serial}` : ''}${k.hidraw && k.hidraw.length ? `, ${k.hidraw.length} hidraw` : ''})`).join(', ') : 'no OnlyKey');
/* which machines had a key in its bootloader at the last change - so it is said once as it comes, and once as it goes */
const inBootloader = new Map();
function keysSaid(machine, keys) {
  line(`[keys] ${machine}: ${keyWords(keys)}`);
  const boot = (keys || []).filter((k) => k.kind === 'bootloader').length;
  const was = inBootloader.get(machine) || 0;
  if (boot > was) line(`[keys] ${machine}: A KEY IS IN BOOTLOADER MODE (HalfKay) - ready to flash`);
  if (boot < was) line(`[keys] ${machine}: the key left bootloader mode`);
  inBootloader.set(machine, boot);
  bus.emit('keys', machine, keys);
}
localTargets.watchKeys((keys) => { localKeys = keys; if (keys !== null) keysSaid('this machine', keys); });

/* lines a process wrote before its app connected (its start-up): held, then handed to the app's record when it does */
const outBefore = new Map(); /* shell -> lines */
function appOut(shell, l) {
  const a = apps.get(shell);
  if (!(a && a.net === 'test') && !LIVE_PREFIXES.some((p) => l.startsWith(p))) return;
  const s = `${stamp()} [main] ${l}`;
  if (a) { keep(a.recent, s); a.emit('log', `[main] ${l}`); }
  else { if (!outBefore.has(shell)) outBefore.set(shell, []); keep(outBefore.get(shell), s); }
  bus.emit('app-line', shell, s);
}

/*
 * dialRemote(url, again): a remote that went (restarted, the box rebooted) is dialed again every 5 s while it is gone -
 * an inactivity redial, like the app's own (src/drive/client.ts) - with its failure logged once, not on every try.
 */
function dialRemote(url, again = false) {
  const known = remotes.get(url);
  if (known && known.ws.readyState <= 1) return;
  const ws = new WS(`${url}/?token=${encodeURIComponent(TOKEN)}`);
  const r = { ws, machine: url, targets: [], waiting: new Map(), nextId: 1, socks: new Map() };
  remotes.set(url, r);
  ws.on('message', (data) => {
    let m;
    try { m = JSON.parse(String(data)); } catch { return; }
    if (m.t === 'shot-now') { shotNow(r.machine); return; }
    if (m.t === 'remote-hello') { r.machine = m.machine; r.targets = m.targets || []; line(`drive-remote ${r.machine} connected (${r.targets.join(', ')})`); remoteHellos.emit('hello', r); return; }
    if (m.t === 'app-open') {
      const sock = new EventEmitter();
      sock.via = r.machine;
      sock.remote = ws;
      sock.cid = m.cid;
      sock.readyState = 1;
      sock.send = (text) => { if (ws.readyState === 1) ws.send(JSON.stringify({ t: 'app-msg', cid: m.cid, data: text })); };
      sock.close = () => { if (ws.readyState === 1) ws.send(JSON.stringify({ t: 'app-close', cid: m.cid })); };
      r.socks.set(m.cid, sock);
      attachApp(sock);
      /* an app the remote held before this server came: asked to introduce itself again (its first hello went elsewhere) */
      sock.send(JSON.stringify({ t: 'hello' }));
      return;
    }
    if (m.t === 'app-msg') { const s = r.socks.get(m.cid); if (s) s.emit('message', m.data); return; }
    if (m.t === 'app-close') { const s = r.socks.get(m.cid); if (s) { r.socks.delete(m.cid); s.readyState = 3; s.emit('close'); } return; }
    if (m.t === 'proc-reply') { const w = r.waiting.get(m.id); if (w) { r.waiting.delete(m.id); w(m); } return; }
    if (m.t === 'keys') { r.keys = m.keys; keysSaid(r.machine, m.keys); return; }
    if (m.t === 'app-out') { appOut(String(m.shell), String(m.line)); return; }
    if (m.t === 'cmd') cmdEvent(r.machine, String(m.name), m.ev || {});
  });
  ws.on('error', (e) => { if (!again) line(`drive-remote ${url}: ${e.message} - dialing it again every 5 s while it is gone`); });
  ws.on('close', () => {
    for (const s of r.socks.values()) { s.readyState = 3; s.remoteGone = true; s.emit('close'); }
    r.socks.clear();
    if (remotes.get(url) === r && r.targets.length) line(`drive-remote ${r.machine} gone - dialing it again every 5 s while it is gone`);
    if (remotes.get(url) === r && REMOTES.includes(url)) setTimeout(() => dialRemote(url, true), 5000);
  });
}

/*
 * start / stop / restart a target: on the remote that has it - and with remotes given, ONLY there (2026-10-31: the
 * box's remote had not reconnected yet, the fallback "this machine" started an Electron app on Windows). Without
 * --remote, this machine's own targets. A remote not connected yet is waited for, by its hello, under a watchdog.
 */
const remoteHellos = new EventEmitter();
async function proc(action, target, args = {}) {
  if (REMOTES.length) {
    for (const u of REMOTES) dialRemote(u);
    const has = () => [...remotes.values()].find((r) => r.ws.readyState === 1 && r.targets.includes(target));
    if (!has()) {
      await new Promise((resolve) => {
        const dog = setTimeout(() => { remoteHellos.off('hello', on); resolve(); }, 30000);
        const on = () => { if (has()) { clearTimeout(dog); remoteHellos.off('hello', on); resolve(); } };
        remoteHellos.on('hello', on);
      });
    }
    if (!has()) return { ok: false, why: `no drive-remote with "${target}" connected (${REMOTES.join(', ')})`, where: 'no remote' };
  }
  for (const r of remotes.values()) {
    if (r.ws.readyState !== 1 || !r.targets.includes(target)) continue;
    const id = r.nextId++;
    /* the machine's answer, under its watchdog: 2 minutes, a build 30 (a cold Gradle build is long) */
    const life = action === 'build' || action === 'hex' ? 30 * 60 : action === 'cli' || action === 'flash' ? 10 * 60 : 120;
    const reply = await new Promise((resolve) => {
      const dog = setTimeout(() => { r.waiting.delete(id); resolve({ ok: false, why: `WATCHDOG: ${r.machine} did not answer "${action} ${target}" in ${life} s` }); }, life * 1000);
      r.waiting.set(id, (m) => { clearTimeout(dog); resolve(m); });
      r.ws.send(JSON.stringify({ t: 'proc', id, action, target, args }));
    });
    return { ...reply, where: r.machine };
  }
  return { ...(await localTargets.act(action, target, args)), where: 'this machine' };
}

/* an action asked of THIS machine and of every connected remote: [{where, ok, what|why}] (run.js doctor) */
async function procAll(action, args = {}) {
  for (const u of REMOTES) dialRemote(u);
  const asks = [localTargets.act(action, '', args).then((r) => ({ ...r, where: 'this machine' }), (e) => ({ ok: false, why: e.message, where: 'this machine' }))];
  for (const r of remotes.values()) {
    if (r.ws.readyState !== 1) continue;
    const id = r.nextId++;
    asks.push(new Promise((resolve) => {
      const dog = setTimeout(() => { r.waiting.delete(id); resolve({ ok: false, why: `WATCHDOG: ${r.machine} did not answer "${action}" in 60 s`, where: r.machine }); }, 60000);
      r.waiting.set(id, (m) => { clearTimeout(dog); resolve({ ...m, where: r.machine }); });
      r.ws.send(JSON.stringify({ t: 'proc', id, action, target: '', args }));
    }));
  }
  return Promise.all(asks);
}

/*
 * AN APP'S OWN MACHINE, ASKED (2026-11-01: the Windows app's press icon asked the BOX's key-state - two "desktop"
 * apps, and proc routes by the target's name, remotes first; with blue-key on the box, the drive would have pressed
 * blue-key for red-key's wait). What concerns an app's key - its state, a press - goes to the machine that app runs on:
 * the remote it came through, else this machine. Never another machine with the same target.
 */
async function procFor(app, action, args = {}) {
  const via = app.ws && app.ws.via;
  if (!via) return { ...(await localTargets.act(action, app.shell, args)), where: 'this machine' };
  const r = [...remotes.values()].find((x) => x.machine === via && x.ws.readyState === 1);
  if (!r) return { ok: false, why: `${via}, the machine ${app.shell} runs on, is not connected`, where: via };
  const id = r.nextId++;
  const reply = await new Promise((resolve) => {
    const dog = setTimeout(() => { r.waiting.delete(id); resolve({ ok: false, why: `WATCHDOG: ${via} did not answer "${action} ${app.shell}" in 120 s` }); }, 120000);
    r.waiting.set(id, (m) => { clearTimeout(dog); resolve(m); });
    r.ws.send(JSON.stringify({ t: 'proc', id, action, target: app.shell, args }));
  });
  return { ...reply, where: via };
}

/*
 * RUN RECORDS (drive debugging #5, Brad 2026-10-31): each run keeps a folder - drive-runs/<date>-<time>-<script>-<app>/
 * with lines.log (every line of it) and run.json (what ran, PASS or FAIL and why, when, how long, the pictures and
 * samples taken while it ran) - so today's run can be laid beside yesterday's. The window lists them (bus 'run').
 */
const RUNS = path.join(path.dirname(SHOTS), 'drive-runs');
function saveRun({ script, app, args, code, reason, started, lines, files, keys }) {
  try {
    const ended = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const id = `${started.getFullYear()}${pad(started.getMonth() + 1)}${pad(started.getDate())}-${pad(started.getHours())}${pad(started.getMinutes())}${pad(started.getSeconds())}-${script.replace(/[^a-z0-9-]/gi, '')}-${app}`;
    const dir = path.join(RUNS, id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'lines.log'), `${lines.join('\n')}\n`);
    const record = { id, script, app, args, verdict: code === 0 ? 'PASS' : 'FAIL', reason, started: started.toISOString(), ended: ended.toISOString(), ms: ended - started, keys, files, dir };
    fs.writeFileSync(path.join(dir, 'run.json'), `${JSON.stringify(record, null, 2)}\n`);
    bus.emit('run', record);
  } catch (e) { line(`run record not kept: ${e.message}`); }
}
/* the kept runs, newest last (the window lists them) */
function pastRuns() {
  try {
    return fs.readdirSync(RUNS).sort().map((d) => { try { return JSON.parse(fs.readFileSync(path.join(RUNS, d, 'run.json'), 'utf8')); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}

/*
 * "USER DOES NOT SEE ACTIVITY" (Brad, 2026-10-31: "i just want a manual trigger to tell you 'user does not see
 * activity'"; "no timer"): the window's button says it, as one line - wake.js's "user" kind hands it to Claude, who
 * looks at what is stuck. It stops nothing. The line names the runs in progress and how long each has been quiet.
 */
const running = new Set();
function noActivity() {
  const now = Date.now();
  const what = [...running].map((r) => `${r.script} (quiet ${Math.round((now - r.quietSince) / 1000)} s)`);
  line(`[user] USER DOES NOT SEE ACTIVITY - runs in progress: ${what.length ? what.join(', ') : 'none'}`);
}

function control(ws) {
  ws.on('message', async (data) => {
    let m;
    try { m = JSON.parse(String(data)); } catch { return; }
    if (m.t !== 'run') return;
    const send = (o) => { try { ws.send(JSON.stringify(o)); } catch { /* the caller went */ } };
    /* the run's record (#5): its lines, the pictures and samples taken while it ran, its verdict */
    const runLines = [];
    const runFiles = [];
    const onFile = (file) => runFiles.push(file);
    bus.on('shot', onFile);
    bus.on('sample', onFile);
    /*
     * its key requests (#6), counted from the app's own "[key]" lines - how hard a run leaned on the key - and its
     * presses from this server's own "pressed:" lines (a request that waits for a press shows its press sheet, not the
     * keyBusy that writes "[key]": the app's lines cannot count those)
     */
    const keys = { requests: 0, presses: 0 };
    const onAppLine = (shell, l) => { if (shell === (m.app || shell) && / \[key\] /.test(l)) keys.requests++; };
    bus.on('app-line', onAppLine);
    const started = new Date();
    let reason = '';
    const run = { script: String(m.script), quietSince: Date.now() };
    running.add(run);
    const watch = (l) => { runLines.push(l); run.quietSince = Date.now(); send({ t: 'line', line: l }); };
    watchers.add(watch);
    let code = 1;
    let shotApp = null;
    try {
      const file = path.join(SCRIPTS, `${String(m.script).replace(/[^a-z0-9-]/gi, '')}.js`);
      if (!fs.existsSync(file)) throw new Error(`no script "${m.script}" (${SCRIPTS})`);
      for (const u of REMOTES) dialRemote(u);
      const shell = String(m.app || [...apps.keys()][0] || 'desktop').split('@')[0];
      /* desktop@linux: that machine's app only - never another machine's with the same name (pickApp) */
      if (m.app && String(m.app).includes('@') && !pickApp(m.app)) throw new Error(`no ${m.app} connected - its app must be up (a run for one machine never starts or drives another's)`);
      /* a shell not connected yet gets a handle too: its script may start it (d.up(), d.start()) */
      const app = pickApp(m.app || shell) || Object.assign(new App(null, { shell, net: 'none' }), { closed: true });
      shotApp = app;
      /* every run loads the scripts and what they require (flows.js) as they are now - a cached flows.js ran an old login
       * for runs after it was changed (2026-10-31) */
      for (const k of Object.keys(require.cache)) if (k.startsWith(__dirname) && k !== __filename && !/targets.js$/.test(k)) delete require.cache[k];
      const say = (t) => line(`[${m.script}] ${t}`);
      say(`start on ${app.shell} (${app.net})${m.args && m.args.length ? ` - ${m.args.join(' ')}` : ''}`);
      await require(file)(driveFor(app, say), m.args || []);
      say('FINISHED');
      code = 0;
    } catch (e) {
      reason = String(e.message).split('\n')[0];
      line(`[${m.script}] STOPPED: ${e.message}`);
      /* the picture of where it stopped, taken by the app itself - the newest connection of that shell (a restart makes a new one) */
      const now = shotApp && apps.get(shotApp.shell);
      if (now) await shotOf(now, `${m.script}-stopped`);
    } finally {
      running.delete(run);
      bus.off('app-line', onAppLine);
      keys.presses = runLines.filter((l) => /\] pressed: /.test(l)).length;
      if (keys.requests || keys.presses) line(`[${m.script}] ${keys.requests} key request(s) without a press, ${keys.presses} press(es)`);
      watchers.delete(watch);
      bus.off('shot', onFile);
      bus.off('sample', onFile);
      saveRun({ script: String(m.script), app: (shotApp && shotApp.shell) || m.app || '?', args: m.args || [], code, reason, started, lines: runLines, files: runFiles, keys });
      send({ t: 'end', code });
    }
  });
}

/*
 * start({port, remotes}): listen for apps and runs, dial the remotes. One per host: the drive app (NW.js) is a
 * single instance, and this is called once from it.
 */
function start({ port = 8790, remotes: urls = [] } = {}) {
  PORT = port;
  REMOTES = urls;
  try { fs.mkdirSync(path.dirname(LOG), { recursive: true }); } catch { /* the window still has it */ }
  logFile = fs.createWriteStream(LOG, { flags: 'a' });
  server.on('error', (e) => line(`drive server: ${e.message}`));
  server.listen(PORT, '127.0.0.1', () => line(`drive server on ws://127.0.0.1:${PORT} (apps: /app, runs: /control)${REMOTES.length ? ` - remotes ${REMOTES.join(', ')}` : ''} - log ${LOG}`));
  for (const u of REMOTES) dialRemote(u);
}

/* what the window shows: the apps and remotes connected now */
function status() {
  return {
    apps: [...apps.values()].map((a) => ({ shell: a.shell, net: a.net, via: a.ws && a.ws.via, flags: a.flags })),
    remotes: [...remotes.values()].map((r) => ({ machine: r.machine, up: r.ws.readyState === 1, targets: r.targets, keys: r.keys || null })),
    localKeys,
  };
}

module.exports = { start, bus, status, shotNow, recentOf, pastRuns, noActivity, SHOTS, RUNS };

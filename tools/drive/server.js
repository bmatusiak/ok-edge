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
  app.on('log', async (l) => {
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
  line(`picture asked from the ${by} window${shell ? ` (${shell})` : ''}`);
  /*
   * and a sample of the log with it (Brad: "the picture now should take a sample of the log"): the drive's last lines
   * and each app's own, up to this moment - written before the pictures are asked, so it is the moment he pressed
   */
  fs.mkdirSync(SHOTS, { recursive: true });
  const tag = `${String(by).replace(/[^a-z0-9-]/gi, '_')}${shell ? `-${shell}` : ''}`;
  const file = path.join(SHOTS, `${stamp().replace(/:/g, '')}-seen-by-${tag}.log`);
  const parts = [`== picture asked from the ${by} window${shell ? ` (${shell})` : ''} at ${new Date().toISOString()}`, '', `== the drive (last ${recent.length} lines)`, ...recent];
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
   */
  function until(goal, { life = 60, fail = ['Try again'] } = {}) {
    const test = typeof goal === 'function' ? () => goal(app) : typeof goal === 'string' ? () => app.has(goal) : null;
    if (test && test()) return Promise.resolve('already');
    const failing = new Set(fail.filter((f) => app.has(f))); /* already showing: only a NEW showing fails */
    return new Promise((resolve, reject) => {
      const off = () => { clearTimeout(dog); app.off('log', onLog); app.off('controls', onState); app.off('screen', onState); app.off('close', onClose); };
      const dog = setTimeout(() => { off(); reject(failure(`WATCHDOG: no "${goal}" in ${life} s`)); }, life * 1000);
      const onLog = (l) => { if (goal instanceof RegExp && goal.test(l)) { off(); resolve(l); } };
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
  async function tap(label, { life = 30 } = {}) {
    await until(() => app.controls.some((c) => c.label === label && c.enabled), { life, fail: [] })
      .catch((e) => { throw failure(`"${label}" never became live: ${e.message.split('\n')[0]}`); });
    const r = await app.call({ t: 'tap', label });
    if (!r.ok) throw failure(`tap "${label}": ${r.why}`);
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
    });
    back.catch(() => {});
    if (act) await act();
    const next = await back;
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

  const api = { app, say, until, tap, fill, fillFile, step, goto, restarted, start, stop, restart, up, has: (l) => app.has(l), shot: (name) => shotOf(app, name) };
  return api;
}

/* ------------------------------------------------------------------ the server */

const server = http.createServer((req, res) => {
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
      pressWhenAsked(app);
      line(`app connected: ${app.shell} (${app.os}, ${app.net})${sock.via ? ` via ${sock.via}` : ''}`);
      hellos.emit('hello', app);
      return;
    }
    if (m.t === 'net') { app.net = String(m.net); line(`[${app.shell}] net: ${app.net}`); app.emit('screen'); return; }
    if (m.t === 'reply') { const w = app.waiting.get(m.id); if (w) { app.waiting.delete(m.id); w(m); } return; }
    if (m.t === 'log') { const l = `${stamp()} ${m.line}`; keep(app.recent, l); bus.emit('app-line', app.shell, l); app.emit('log', String(m.line)); return; }
    if (m.t === 'controls') { app.controls = m.list || []; app.top = m.top || 0; app.flags = m.flags || {}; app.emit('controls'); return; }
    if (m.t === 'screen') { app.text = String(m.text || ''); app.emit('screen'); }
  });
  sock.on('close', () => {
    if (!app) return;
    if (apps.get(app.shell) === app) apps.delete(app.shell);
    line(`app gone: ${app.shell}`);
    app.closed = true;
    app.emit('close');
  });
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
const localTargets = createTargets((l) => line(l));

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
    if (m.t === 'proc-reply') { const w = r.waiting.get(m.id); if (w) { r.waiting.delete(m.id); w(m); } }
  });
  ws.on('error', (e) => { if (!again) line(`drive-remote ${url}: ${e.message} - dialing it again every 5 s while it is gone`); });
  ws.on('close', () => {
    for (const s of r.socks.values()) { s.readyState = 3; s.emit('close'); }
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
async function proc(action, target) {
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
    const reply = await new Promise((resolve) => {
      const dog = setTimeout(() => { r.waiting.delete(id); resolve({ ok: false, why: `WATCHDOG: ${r.machine} did not answer "${action} ${target}" in 120 s` }); }, 120000);
      r.waiting.set(id, (m) => { clearTimeout(dog); resolve(m); });
      r.ws.send(JSON.stringify({ t: 'proc', id, action, target }));
    });
    return { ...reply, where: r.machine };
  }
  return { ...(await localTargets.act(action, target)), where: 'this machine' };
}

function control(ws) {
  ws.on('message', async (data) => {
    let m;
    try { m = JSON.parse(String(data)); } catch { return; }
    if (m.t !== 'run') return;
    const send = (o) => { try { ws.send(JSON.stringify(o)); } catch { /* the caller went */ } };
    const watch = (l) => send({ t: 'line', line: l });
    watchers.add(watch);
    let code = 1;
    let shotApp = null;
    try {
      const file = path.join(SCRIPTS, `${String(m.script).replace(/[^a-z0-9-]/gi, '')}.js`);
      if (!fs.existsSync(file)) throw new Error(`no script "${m.script}" (${SCRIPTS})`);
      for (const u of REMOTES) dialRemote(u);
      const shell = m.app || [...apps.keys()][0] || 'desktop';
      /* a shell not connected yet gets a handle too: its script may start it (d.up(), d.start()) */
      const app = apps.get(shell) || Object.assign(new App(null, { shell, net: 'none' }), { closed: true });
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
      line(`[${m.script}] STOPPED: ${e.message}`);
      /* the picture of where it stopped, taken by the app itself - the newest connection of that shell (a restart makes a new one) */
      const now = shotApp && apps.get(shotApp.shell);
      if (now) await shotOf(now, `${m.script}-stopped`);
    } finally {
      watchers.delete(watch);
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
    remotes: [...remotes.values()].map((r) => ({ machine: r.machine, up: r.ws.readyState === 1, targets: r.targets })),
  };
}

module.exports = { start, bus, status, shotNow, recentOf, SHOTS };

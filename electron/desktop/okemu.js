'use strict';

/**
 * NativeOkEmu on the desktop: the soft key is node-onlykey-emulator (ok-edge stage 1b: one soft
 * key, built for the phone and for Node), run in ITS OWN Node.js process - electron/okemu-host.js,
 * started here with plain Node (OKEDGE_NODE, else `node` on the PATH). It cannot run in an Electron
 * process: Chromium reserves the low 4 GB that the 32-bit firmware's flash needs (okemu-host.js).
 *
 * This side relays the app's calls to the host and its events to the page, and keeps what the app
 * asks synchronously. Each method behaves as the phone's NativeOkEmuModule does:
 *   storage     <userData>/okemu for the default slot, <userData>/okemu/<slot> for any other
 *               (flash.bin + eeprom.bin) - a slot is another device, never shared
 *   start       while running: "already running", with the folder it runs on (the net the app is on)
 *   restart     refused, with the phone's reason: the firmware's loop never returns, so stop-then-start
 *               would run a SECOND firmware beside the first, which faults once its flash is unmapped
 *               (the desktop crashed exactly so: an access violation reading the old flash)
 *   restartApp  the safe restart - a NEW soft-key process (and the page reloaded), as the phone
 *               restarts its app process; flash.bin and eeprom.bin persist
 *   deleteSlot  only a testnet slot, and never the one running
 */
const fs = require('fs');
const path = require('path');
const { fork } = require('child_process');
const { app, BrowserWindow } = require('electron');

let send = () => {};
let host = null;
let hostFailed = null;
let ready = null;
let nextId = 1;
const waiting = new Map();
let runningDir = null;

/* the host, started once with plain Node; `ready` settles when the emulator has loaded in it */
function startHost() {
  if (host || hostFailed) return;
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const proc = fork(path.join(__dirname, '..', 'okemu-host.js'), [], {
    execPath: process.env.OKEDGE_NODE || 'node',
    env,
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    /* Windows gives a console program started from a GUI app a console window of its own */
    windowsHide: true,
  });
  host = proc;
  ready = new Promise((resolve) => {
    /* only for this process: after restartApp a new one is the soft key, and the old one's end changes nothing */
    const current = () => host === proc;
    const fail = (why) => {
      if (!current()) { resolve(false); return; }
      hostFailed = why; host = null; console.error(`[okemu] ${why}`); resolve(false);
    };
    console.log(`[okemu] the soft key's Node process started (pid ${proc.pid})`);
    proc.once('error', (e) => fail(`the soft key's Node process did not start: ${e.message}`));
    proc.on('message', (m) => {
      if (m && m.ready === true) { console.log('[okemu] the soft key loaded'); resolve(true); }
      else if (m && m.ready === false) fail(`the soft key did not load: ${m.error}`);
      else if (m && m.event) {
        send(m.event, m.payload);
        /* the CLI's side too (hosting.js): the key's reports as the lib's pipe gives them */
        if (m.event === 'NativeOkEmu:onStream' && m.payload) {
          const ev = { iface: m.payload.iface, dir: m.payload.dir, bytes: Buffer.from(m.payload.hex || '', 'hex') };
          for (const l of sharedStream) l(ev);
        }
      }
      else if (m && m.id && waiting.has(m.id)) {
        const { ok, ko } = waiting.get(m.id);
        waiting.delete(m.id);
        if (m.error) ko(new Error(m.error)); else ok(m.result);
      }
    });
    proc.once('exit', (code) => {
      if (!current()) return;
      for (const { ko } of waiting.values()) ko(new Error(`the soft key's process ended (${code})`));
      for (const l of sharedClose) l(new Error('the soft key stopped'));
      waiting.clear();
      runningDir = null;
      if (!hostFailed) fail(`the soft key's process ended (${code})`);
    });
  });
}

async function call(method, ...args) {
  if (!(await ready)) throw new Error(hostFailed);
  const id = nextId++;
  return new Promise((ok, ko) => {
    waiting.set(id, { ok, ko });
    host.send({ id, method, args });
  });
}

const plainSlot = (s) => /^[A-Za-z0-9._-]*$/.test(s);
const dirFor = (slot) => (slot ? path.join(app.getPath('userData'), 'okemu', slot) : path.join(app.getPath('userData'), 'okemu'));
const needRunning = () => { if (!runningDir) throw new Error('firmware is not running'); };

/*
 * WHERE THIS SOFT KEY LIVES, FOR THE CLI (Brad, 2026-10-25: "--soft-key will boot the same softkey the desktop app
 * does"). The app's storage sits in Electron's profile, whose folder name is not one a CLI can know, so each start
 * writes it to the shared home: ~/.onlykey-js/softkey.json, per net (the slot's -test suffix), with the emulator build
 * it loaded - `onlykey-js --soft-key` boots exactly this soft key when the app is not running.
 */
function recordForCli(slot, dir) {
  try {
    const home = path.join(require('os').homedir(), '.onlykey-js');
    const file = path.join(home, 'softkey.json');
    let rec = {};
    try { rec = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* none yet */ }
    const net = /-test$/.test(slot) ? 'test' : 'live';
    const emulator = path.resolve(process.env.OKEDGE_EMULATOR || path.join(__dirname, '..', '..', '..', 'node-onlykey-emulator'));
    rec[net] = { storageDir: dir, emulator, slot, at: new Date().toISOString() };
    fs.mkdirSync(home, { recursive: true, mode: 0o700 });
    fs.writeFileSync(file, `${JSON.stringify(rec, null, 2)}\n`, { mode: 0o600 });
  } catch (e) {
    console.error(`[okemu] could not record the soft key for the CLI: ${e.message}`);
  }
}

/* a start that fails says why in this process's log too - the page shows only that it failed */
async function start(storageSlot = '') {
  const r = await startOnce(storageSlot);
  if (!r.started) console.error(`[okemu] the soft key did not start: ${r.message}`);
  return r;
}

async function startOnce(storageSlot) {
  if (!plainSlot(storageSlot)) return { started: false, message: `not a storage slot: "${storageSlot}"`, storageDir: '' };
  const dir = dirFor(storageSlot);
  /* the folder it RUNS on, not the one asked for: after a reload the app learns which net it is on */
  if (runningDir) return { started: false, message: 'already running', storageDir: runningDir };
  try {
    fs.mkdirSync(dir, { recursive: true });
    await call('start', dir);
    runningDir = dir;
    recordForCli(storageSlot, dir);
    return { started: true, message: '', storageDir: dir };
  } catch (e) {
    return { started: false, message: e.message, storageDir: dir };
  }
}

async function stop() {
  if (!runningDir) return;
  await call('stop');
  runningDir = null;
}

function restart() {
  throw new Error('in-process firmware restart is not implemented: the firmware thread only exits through '
    + 'the AIRCR trap. Restart the app process instead - flash.bin and eeprom.bin persist, so device state is preserved.');
}

/* the process restart: the old soft-key process ends (its firmware with it), a new one starts */
async function restartApp() {
  const old = host;
  host = null;
  hostFailed = null;
  runningDir = null;
  for (const { ko } of waiting.values()) ko(new Error('the soft key restarted'));
  waiting.clear();
  if (old) await new Promise((resolve) => { old.once('exit', resolve); old.kill(); });
  startHost();
  for (const w of BrowserWindow.getAllWindows()) w.reload();
}

function deleteSlot(storageSlot) {
  if (!storageSlot || !plainSlot(storageSlot) || !storageSlot.endsWith('test')) {
    throw new Error(`only a testnet slot can be deleted, not "${storageSlot}"`);
  }
  const dir = dirFor(storageSlot);
  if (runningDir === dir) throw new Error('the firmware is running on the testnet - restart the app and clear it from the live chain');
  fs.rmSync(dir, { recursive: true, force: true });
}

/* the calls that need the firmware running, relayed as they are */
const relayed = (method) => async (...args) => { needRunning(); return call(method, ...args); };
/* the polls an app makes all the time: a quiet answer while the firmware is not running */
const polled = (method, idle) => async (...args) => (runningDir ? call(method, ...args) : idle);

/*
 * THE SOFT KEY FOR THE CLI (Brad, 2026-10-25: "cli talks to the desktop if its open, so the desktop app does the work
 * ... its so we can use the softkey in the desktop, and the cli should not need to know what the desktop app is
 * talking to"). The same contract as usbhid.shared - the lib's pipe (isRunning, start, write, on 'stream' / 'close',
 * device, interfaces) - over the soft key's own process: writes go to its HID, its reports come back. It never starts
 * the soft key: the page does, when the person logs in to it.
 */
const sharedStream = new Set();
const sharedClose = new Set();
const SOFT_PATH = 'ok-edge desktop soft key';
const shared = {
  isRunning: () => !!runningDir,
  async start() {
    if (!runningDir) throw new Error('the desktop app\'s soft key is not running - log in to it in the app first');
    return { started: true, path: SOFT_PATH };
  },
  async stop() { /* the page decides when the soft key stops */ },
  async write(iface, bytes) {
    if (!runningDir) throw new Error('the desktop app\'s soft key is not running');
    return call('writeHid', iface, Buffer.from(bytes).toString('hex'));
  },
  on(event, listener) {
    const set = event === 'stream' ? sharedStream : event === 'close' ? sharedClose : null;
    if (!set) throw new Error(`the soft key's pipe has no "${event}" event`);
    set.add(listener);
    return () => set.delete(listener);
  },
  get device() { return runningDir ? { path: SOFT_PATH, product: 'OnlyKey (soft key)', serialNumber: '' } : null; },
  /* the vendor and FIDO interfaces, as the lib numbers them (src/protocol/msg.js IFACE) */
  interfaces() { return runningDir ? [{ iface: 2, path: SOFT_PATH }, { iface: 1, path: SOFT_PATH }] : []; },
};

module.exports = {
  shared,
  attach(push) {
    send = push;
    startHost();
  },
  /* the spec's synchronous methods: answered in place (preload invokeSync) */
  syncHandlers: {
    'NativeOkEmu:isAvailable': () => !hostFailed,
    'NativeOkEmu:isRunning': () => !!runningDir,
    'NativeOkEmu:debuggingOn': () => false,
  },
  handlers: {
    'NativeOkEmu:start': start,
    'NativeOkEmu:stop': stop,
    'NativeOkEmu:writeHid': relayed('writeHid'),
    'NativeOkEmu:setButton': relayed('setButton'),
    'NativeOkEmu:setButtonTicks': relayed('setButtonTicks'),
    'NativeOkEmu:pressQueue': relayed('pressQueue'),
    'NativeOkEmu:pressPending': polled('pressPending', 0),
    'NativeOkEmu:confirmState': polled('confirmState', -1),
    'NativeOkEmu:buttonTicksLeft': polled('buttonTicksLeft', 0),
    'NativeOkEmu:rounds': polled('rounds', 0),
    'NativeOkEmu:kbdSetReport': relayed('kbdSetReport'),
    'NativeOkEmu:kbdGetReport': relayed('kbdGetReport'),
    'NativeOkEmu:factoryReset': relayed('factoryReset'),
    'NativeOkEmu:deleteSlot': deleteSlot,
    'NativeOkEmu:restart': restart,
    'NativeOkEmu:restartApp': restartApp,
  },
};

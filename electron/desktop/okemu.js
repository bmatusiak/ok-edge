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
 *   restart     the same folder started again; restartApp stops the key and reloads the page
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
  host = fork(path.join(__dirname, '..', 'okemu-host.js'), [], {
    execPath: process.env.OKEDGE_NODE || 'node',
    env,
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    /* Windows gives a console program started from a GUI app a console window of its own */
    windowsHide: true,
  });
  ready = new Promise((resolve) => {
    const fail = (why) => { hostFailed = why; host = null; console.error(`[okemu] ${why}`); resolve(false); };
    console.log(`[okemu] the soft key's Node process started (pid ${host.pid})`);
    host.once('error', (e) => fail(`the soft key's Node process did not start: ${e.message}`));
    host.on('message', (m) => {
      if (m && m.ready === true) { console.log('[okemu] the soft key loaded'); resolve(true); }
      else if (m && m.ready === false) fail(`the soft key did not load: ${m.error}`);
      else if (m && m.event) send(m.event, m.payload);
      else if (m && m.id && waiting.has(m.id)) {
        const { ok, ko } = waiting.get(m.id);
        waiting.delete(m.id);
        if (m.error) ko(new Error(m.error)); else ok(m.result);
      }
    });
    host.once('exit', (code) => {
      for (const { ko } of waiting.values()) ko(new Error(`the soft key's process ended (${code})`));
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

/* a start that fails says why in this process's log too - the page shows only that it failed */
async function start(storageSlot = '') {
  const r = await startOnce(storageSlot);
  if (!r.started) console.error(`[okemu] the soft key did not start: ${r.message}`);
  return r;
}

async function startOnce(storageSlot) {
  if (!plainSlot(storageSlot)) return { started: false, message: `not a storage slot: "${storageSlot}"`, storageDir: '' };
  const dir = dirFor(storageSlot);
  if (runningDir === dir) return { started: true, message: '', storageDir: dir };
  if (runningDir) return { started: false, message: `the soft key is already running on ${runningDir}`, storageDir: runningDir };
  try {
    fs.mkdirSync(dir, { recursive: true });
    await call('start', dir);
    runningDir = dir;
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

async function restart() {
  const dir = runningDir;
  if (!dir) throw new Error('firmware is not running');
  await stop();
  return start(path.relative(dirFor(''), dir));
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

module.exports = {
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
    'NativeOkEmu:restartApp': async () => { await stop(); for (const w of BrowserWindow.getAllWindows()) w.reload(); },
  },
};

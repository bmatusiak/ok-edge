'use strict';

/**
 * THE SOFT KEY'S OWN PROCESS on the desktop, run by plain Node.js (node.exe), not by Electron.
 *
 * Why its own process: the firmware is 32-bit code that keeps addresses in 32-bit variables, so
 * its flash must sit below 4 GB (node-onlykey-emulator src/ok_hal.cpp). Chromium reserves the whole
 * low 4 GB of every Electron process on Windows, on purpose (pointer-truncation hardening), so the
 * flash has nowhere to go there; plain Node leaves it free - which is how the emulator has always
 * run, in the kit and the CLI. Electron's main process starts this script with Node
 * (electron/desktop/okemu.js) and relays the app's calls to it. A firmware crash ends this
 * process, not the app.
 *
 * The protocol, over Node's process messaging (fork's IPC channel):
 *   in   {id, method, args}            a call: start(storageDir) / stop / writeHid(iface, hex) / ...
 *   out  {id, result} | {id, error}    its answer
 *   out  {event, payload}              the firmware's streams, LED, plugin events, restart request
 *   out  {ready: true}                 once, when the emulator has loaded (or {ready: false, error})
 */
const path = require('path');

let emu;
try {
  const repo = process.env.OKEDGE_EMULATOR || path.join(__dirname, '..', '..', 'node-onlykey-emulator');
  emu = require(path.join(repo, 'emulator'));
} catch (e) {
  process.send({ ready: false, error: e.message });
  process.exit(1);
}

const push = (event, payload) => process.send({ event, payload });
/* the direction as the phone's module gives it - the library's transport.DIR numbers (OUT 0: device
   to host, IN 1: host to device) - where the emulator's Node API says 'out' / 'in' */
const DIR = { out: 0, in: 1 };
emu.on('stream', ({ buffer, iface, dir }) => push('NativeOkEmu:onStream', { iface, dir: DIR[dir] ?? dir, hex: buffer.toString('hex'), length: buffer.length }));
/* packed 0xRRGGBB, as the phone's native module gives them (the emulator's own event has {r, g, b} objects) */
emu.on('led', (pixels) => push('NativeOkEmu:onLed', { pixels: Array.from(pixels, (p) => (typeof p === 'number' ? p : ((p.r & 0xff) << 16) | ((p.g & 0xff) << 8) | (p.b & 0xff))) }));
emu.on('plugin', (name, data) => push('NativeOkEmu:onPluginEvent', { name, hex: Buffer.from(data || []).toString('hex') }));
emu.on('restart', () => push('NativeOkEmu:onRestartRequested', null));

const METHODS = {
  start: (storageDir) => { emu.start({ storageDir }); return true; },
  stop: () => emu.stop(),
  writeHid: async (iface, hex) => {
    const buffer = Buffer.from(hex, 'hex');
    /* a VENDOR report resolves once the firmware has TAKEN it - the order a USB write gives a hard key */
    if (iface === emu.IFACE.VENDOR) await emu.writeHidTaken(buffer, iface);
    else emu.writeHid(buffer, iface);
    return buffer.length;
  },
  setButton: (button, down) => emu.setButton(button, down),
  setButtonTicks: (button, ticks) => emu.setButtonTicks(button, ticks),
  pressQueue: (buttons, ticks) => emu.pressQueue(buttons, ticks),
  pressPending: () => emu.pressPending(),
  confirmState: () => emu.confirmState(),
  buttonTicksLeft: (button) => emu.buttonTicksLeft(button),
  rounds: () => emu.rounds(),
  kbdSetReport: (hex) => emu.kbdSetReport(Buffer.from(hex, 'hex')),
  kbdGetReport: () => Buffer.from(emu.kbdGetReport()).toString('hex'),
  factoryReset: () => emu.factoryReset(),
};

process.on('message', async ({ id, method, args = [] }) => {
  try {
    if (!Object.prototype.hasOwnProperty.call(METHODS, method)) throw new Error(`no soft key method "${method}"`);
    process.send({ id, result: await METHODS[method](...args) });
  } catch (e) {
    process.send({ id, error: e.message });
  }
});

/* the app went away: the firmware stops with it (flash and EEPROM are already on disk) */
process.on('disconnect', () => { try { emu.stop(); } catch { /* not running */ } process.exit(0); });

process.send({ ready: true });

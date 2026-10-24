'use strict';
/*
 * THE HARD KEY OVER USB, ON THE DESKTOP (ok-edge stage 4): the phone's NativeUsbHid spec, served
 * from Electron's main process by the lib's own node-hid pipe (node-onlykey-lib cli/transport-hid.js),
 * the one onlykey-js uses. So the vendor interface (by usage page), the debug console, FIDO's
 * pairing, the report ID and the emulator driver's look-alike interfaces are decided in ONE place,
 * and a fix there reaches the CLI and this app together.
 *
 * WHICH KEY. This is the hard-key screen's module; the soft key has its own (NativeOkEmu). The
 * emulator's Windows driver (okvhid) lists a full OnlyKey beside a real one - same ids, usage pages
 * and serial - and hidapi gives those interfaces the number -1. So when exactly one
 * interface-numbered (USB) vendor interface is listed, that one is opened; otherwise the pipe
 * chooses or refuses (two real keys: it names the paths, never takes the first).
 *
 * THE ECHO. UsbPipe.ts echoes its own writes, as it does over Android's module, so only the key's
 * reports (DIR.OUT) are pushed as onData; the pipe's own echo stays here.
 *
 * STATUS. As Android: 'connected' once open, 'disconnected' on disconnect() and when the key goes
 * away (the pipe's 'close': unplugged, restarted), 'error' when it cannot be opened.
 */
const { createHidPipe, loadNodeHid, findOnlyKeys } = require('node-onlykey-lib/cli/transport-hid');
const { DIR, usb: { describe } } = require('node-onlykey-lib/transport');

let send = () => {};
let pipe = null;
let offs = [];

/*
 * ONE KEY, TWO USERS: the page (this module's NativeUsbHid channels) and the CLI through the desktop
 * app (electron/desktop/hosting.js -> node-onlykey-lib desktop/serve.js). They must share ONE open
 * pipe - a second open of the same interface fails on Windows - and the pipe is replaced on every
 * reconnect, so the CLI's side holds this stable stand-in instead: it forwards to whichever pipe is
 * open now, and opens one on start(). Same contract as cli/transport-hid's pipe.
 */
const sharedStream = new Set();
const sharedClose = new Set();
const shared = {
  isRunning: () => !!pipe && pipe.isRunning(),
  async start() { await connect(); return { started: true, path: pipe.device.path }; },
  async stop() { /* the page decides when the key closes */ },
  async write(iface, bytes) {
    if (!pipe) throw new Error('the OnlyKey is not open');
    return pipe.write(iface, bytes);
  },
  on(event, listener) {
    const set = event === 'stream' ? sharedStream : event === 'close' ? sharedClose : null;
    if (!set) throw new Error(`the shared pipe has no "${event}" event`);
    set.add(listener);
    return () => set.delete(listener);
  },
  get device() { return pipe ? pipe.device : null; },
  interfaces() { return pipe ? pipe.interfaces() : []; },
};

const status = (state, message = '') => send('NativeUsbHid:onStatus', { state, transport: 'usb', message });
const isUsb = (d) => d.interface >= 0;

function hardKeyPath(HID) {
  const usb = findOnlyKeys(HID).vendor.filter(isUsb);
  return usb.length === 1 ? usb[0].path : undefined;
}

function drop() {
  for (const off of offs) off();
  offs = [];
  pipe = null;
}

function result() {
  return {
    transport: 'usb',
    vendorId: pipe.device.vendorId,
    productId: pipe.device.productId,
    packetSize: 64,
    interfaces: pipe.interfaces().map((i) => {
      const d = describe(i.iface);
      return {
        iface: i.iface,
        interfaceNumber: i.interfaceNumber,
        usagePage: i.usagePage,
        usage: i.usage,
        packetSizeIn: d.endpointIn,
        packetSizeOut: d.endpointOut,
        identifiedBy: 'usagePage',
      };
    }),
  };
}

async function connect() {
  if (pipe && pipe.isRunning()) return result();
  const HID = loadNodeHid();
  const p = createHidPipe({ loadHid: () => HID, path: hardKeyPath(HID) });
  try {
    await p.start();
  } catch (e) {
    status('error', e.message);
    throw e;
  }
  pipe = p;
  offs = [
    p.on('stream', (e) => {
      for (const l of [...sharedStream]) l(e);
      if (e.dir !== DIR.OUT) return;
      send('NativeUsbHid:onData', { iface: e.iface, hex: Buffer.from(e.bytes).toString('hex'), length: e.bytes.length });
    }),
    p.on('close', (err) => {
      if (pipe !== p) return;
      drop();
      for (const l of [...sharedClose]) l(err);
      status('disconnected', err && err.message);
    }),
  ];
  status('connected', p.device.path);
  return result();
}

async function disconnect() {
  if (!pipe) return;
  const p = pipe;
  drop();
  await p.stop();
  status('disconnected', 'closed by the app');
}

/* the real keys hidapi lists, one entry per vendor interface (the emulator driver's are left out) */
async function listDevices() {
  const found = findOnlyKeys(loadNodeHid());
  return found.vendor.filter(isUsb).map((d) => ({
    deviceName: d.path,
    vendorId: d.vendorId,
    productId: d.productId,
    productName: d.product || '',
    manufacturerName: d.manufacturer || '',
    interfaceCount: found.onlykeys.filter(isUsb).length,
    hasPermission: true,
    maxReportSize: 64,
  }));
}

async function write(iface, hex) {
  if (!pipe) throw new Error('the OnlyKey is not open');
  return pipe.write(iface, Uint8Array.from(Buffer.from(String(hex), 'hex')));
}

module.exports = {
  shared,
  attach(push) { send = push; },
  syncHandlers: {
    'NativeUsbHid:isConnected': () => !!pipe && pipe.isRunning(),
  },
  handlers: {
    'NativeUsbHid:listDevices': listDevices,
    'NativeUsbHid:connect': connect,
    'NativeUsbHid:disconnect': disconnect,
    'NativeUsbHid:write': write,
  },
};

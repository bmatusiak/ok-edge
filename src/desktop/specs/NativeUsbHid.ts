/* the hard key over USB: the lib's node-hid pipe in Electron's main process (electron/desktop/usbhid.js) (module.ts: how a desktop module is made) */
import type {Spec} from 'okedge-native/specs/NativeUsbHid';
import {desktopModule, invoke, invokeSync} from './module';

const call = (m: string) => (...args: unknown[]) => invoke(`NativeUsbHid:${m}`, ...args);

export default desktopModule<Spec>('NativeUsbHid', {
  /* USB is the desktop's only transport here; the phone's TCP mock is not on this shell */
  setTransport() {},
  getTransport: () => 'usb',
  configureTcp() {},
  /* no grant to ask for on a desktop: a key that will not open (Linux udev) says so on connect */
  requestPermission: async () => true,
  isConnected: () => invokeSync<boolean>('NativeUsbHid:isConnected') === true,
  ...Object.fromEntries(['listDevices', 'connect', 'disconnect', 'write'].map((m) => [m, call(m)])),
}, ['onStatus', 'onData'], {pushed: true});

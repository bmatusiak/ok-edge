/* the hard key over USB: node-hid in Electron's main process (stage 4, step 4) - not yet (module.ts: how a desktop module is made) */
import type {Spec} from 'okedge-native/specs/NativeUsbHid';
import {desktopModule} from './module';
export default desktopModule<Spec>('NativeUsbHid', {
  setTransport() {},
  getTransport: () => 'usb',
  configureTcp() {},
  isConnected: () => false,
}, ['onStatus', 'onData']);

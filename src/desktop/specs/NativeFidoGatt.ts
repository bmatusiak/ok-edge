/* the computer link is the phone's own (a BLE peripheral): absent on the desktop (module.ts: how a desktop module is made) */
import type {Spec} from 'okedge-native/specs/NativeFidoGatt';
import {desktopModule} from './module';
export default desktopModule<Spec>('NativeFidoGatt', {
  isSupported: async () => false,
  permissionStatus: async () => ({ notificationsApply: false, notifications: false, bluetooth: false }),
  openAppSettings() {},
  configure() {},
  setIoPolicy() {},
  getState: () => 'unsupported',
  fidoHandle: () => 0,
  fidoKnownHandle: () => 0,
}, ["onGattStatus","onCtapRequest"]);

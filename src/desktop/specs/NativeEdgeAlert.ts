/* Edge's phone alarms (notifications, the lock screen's Hold): absent on the desktop (module.ts: how a desktop module is made) */
import type {Spec} from 'okedge-native/specs/NativeEdgeAlert';
import {desktopModule} from './module';
export default desktopModule<Spec>('NativeEdgeAlert', {
  post() {},
  takeOpenedSeq: () => -1,
  postBluetooth() {},
  beat() {},
  setWatching() {},
  takeHoldRequest: () => false,
}, ["onHoldRequested","onWatchTick"]);

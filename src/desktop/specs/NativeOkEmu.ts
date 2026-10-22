/* the soft key: node-onlykey-emulator's Node addon in Electron's main process (stage 4, step 3) - not yet (module.ts: how a desktop module is made) */
import type {Spec} from 'okedge-native/specs/NativeOkEmu';
import {desktopModule} from './module';
export default desktopModule<Spec>('NativeOkEmu', {
  isAvailable: () => false,
  isRunning: () => false,
  setAttention() {},
  hushPress() {},
  markSplashDone() {},
  splashDoneThisProcess: () => false,
  debuggingOn: () => false,
}, ['onStream', 'onLed', 'onPluginEvent', 'onRestartRequested']);

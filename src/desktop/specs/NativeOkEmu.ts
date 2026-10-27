/* the soft key: node-onlykey-emulator's Node addon in Electron's main process (electron/desktop/okemu.js) (module.ts: how a desktop module is made) */
import type {Spec} from 'okedge-native/specs/NativeOkEmu';
import {desktopModule, invoke, invokeSync} from './module';

const call = (m: string) => (...args: unknown[]) => invoke(`NativeOkEmu:${m}`, ...args);

export default desktopModule<Spec>('NativeOkEmu', {
  isAvailable: () => invokeSync<boolean>('NativeOkEmu:isAvailable') === true,
  isRunning: () => invokeSync<boolean>('NativeOkEmu:isRunning') === true,
  debuggingOn: () => invokeSync<boolean>('NativeOkEmu:debuggingOn') === true,
  /* the phone's attention sound and splash bookkeeping: nothing to do on the desktop */
  setAttention() {},
  hushPress() {},
  /* the silent-use notice's sound: the page plays it itself (src/ui/pressSound.ts chimeOnce) */
  chime() {},
  markSplashDone() {},
  splashDoneThisProcess: () => false,
  ...Object.fromEntries(['start', 'stop', 'writeHid', 'setButton', 'setButtonTicks', 'pressQueue', 'pressPending',
    'confirmState', 'buttonTicksLeft', 'rounds', 'kbdSetReport', 'kbdGetReport', 'factoryReset', 'deleteSlot',
    'restart', 'restartApp'].map((m) => [m, call(m)])),
}, ['onStream', 'onLed', 'onPluginEvent', 'onRestartRequested'], {pushed: true});

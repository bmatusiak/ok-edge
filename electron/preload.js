'use strict';

/**
 * The page's ONLY way into the desktop's main process (electron/main.js). Kept in the repo, not
 * generated (guncelium's desktop depended on a preload a tool wrote and git ignored).
 *
 * One function, `window.okedge.invoke(channel, ...args)`, and only for the channels below - a
 * channel not listed is refused here, before anything reaches the main process. src/platform.ts
 * takes `window.okedge` being present as "this is the desktop shell".
 */
const { contextBridge, ipcRenderer } = require('electron');

/* what the page may ask for - the same names electron/main.js and electron/desktop register */
const CHANNELS = new Set([
  'okedge:about',
  'NativeRsaGen:generatePrimes',
  'NativeSecrets:boxSeal', 'NativeSecrets:boxOpen', 'NativeSecrets:boxForget',
  ...['start', 'stop', 'writeHid', 'setButton', 'setButtonTicks', 'pressQueue', 'pressPending', 'confirmState',
    'buttonTicksLeft', 'rounds', 'kbdSetReport', 'kbdGetReport', 'factoryReset', 'deleteSlot', 'restart', 'restartApp']
    .map((m) => `NativeOkEmu:${m}`),
  ...['listDevices', 'connect', 'disconnect', 'write'].map((m) => `NativeUsbHid:${m}`),
  /* the person's answer to a CLI's request (electron/desktop/hosting.js) */
  'okedge:hostAnswer',
  /* the hard key's budget history from the shared records (electron/desktop/hosting.js) */
  'okedge:hardKeyHistory',
  /* the hard key's "my device name" (electron/desktop/hosting.js -> the lib's nametag.js) */
  'okedge:hardKeyName', 'okedge:hardKeySetName',
]);
/* a spec's synchronous methods - answered in place by the main process (cheap questions only) */
const SYNC_CHANNELS = new Set(['NativeOkEmu:isAvailable', 'NativeOkEmu:isRunning', 'NativeOkEmu:debuggingOn',
  'NativeUsbHid:isConnected']);
/* what the main process may push to the page: the native modules' events (src/desktop/specs) */
const EVENTS = new Set(['NativeOkEmu:onStream', 'NativeOkEmu:onLed', 'NativeOkEmu:onPluginEvent', 'NativeOkEmu:onRestartRequested',
  'NativeUsbHid:onStatus', 'NativeUsbHid:onData',
  'okedge:hostSay', 'okedge:hostAsk', 'okedge:hostDone']);

contextBridge.exposeInMainWorld('okedge', {
  invoke(channel, ...args) {
    if (!CHANNELS.has(channel)) return Promise.reject(new Error(`ok-edge: channel "${channel}" is not allowed`));
    return ipcRenderer.invoke(channel, ...args);
  },
  invokeSync(channel, ...args) {
    if (!SYNC_CHANNELS.has(channel)) throw new Error(`ok-edge: channel "${channel}" is not allowed`);
    return ipcRenderer.sendSync(channel, ...args);
  },
  /* subscribe to one pushed event; returns the way to stop. The page never sees the IPC event object. */
  on(channel, listener) {
    if (!EVENTS.has(channel)) throw new Error(`ok-edge: event "${channel}" is not allowed`);
    const handler = (_event, payload) => listener(payload);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
});

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

const CHANNELS = new Set(['okedge:about']);

contextBridge.exposeInMainWorld('okedge', {
  invoke(channel, ...args) {
    if (!CHANNELS.has(channel)) return Promise.reject(new Error(`ok-edge: channel "${channel}" is not allowed`));
    return ipcRenderer.invoke(channel, ...args);
  },
});

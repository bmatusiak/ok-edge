'use strict';

/**
 * THE DESKTOP'S HALF OF THE PHONE'S NATIVE MODULES (stage 4): one file per capability, each giving
 *   handlers       IPC channel -> function (async on the page: window.okedge.invoke)
 *   syncHandlers   IPC channel -> function, for a spec's synchronous methods (window.okedge.invokeSync)
 *   attach(push)   optional: a way to push its events to the page
 * electron/main.js registers them. The page reaches them only through electron/preload.js, whose
 * allowlists name the same channels. The page's half is src/desktop/specs.
 */
const MODULES = [require('./rsagen'), require('./secrets'), require('./okemu'), require('./usbhid'), require('./hosting'), require('./sync')];

const handlers = Object.assign({}, ...MODULES.map((m) => m.handlers || {}));
const syncHandlers = Object.assign({}, ...MODULES.map((m) => m.syncHandlers || {}));

function attach(send) {
  for (const m of MODULES) if (typeof m.attach === 'function') m.attach(send);
}

/* what runs for the app's life (hosting: the CLI's socket) - started once the app is ready, stopped at quit */
const start = () => Promise.all(MODULES.map((m) => (typeof m.start === 'function' ? m.start() : null)));
const stop = () => Promise.all(MODULES.map((m) => (typeof m.stop === 'function' ? m.stop() : null)));

module.exports = { handlers, syncHandlers, attach, start, stop };

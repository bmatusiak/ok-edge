'use strict';

/**
 * THE DESKTOP'S HALF OF THE PHONE'S NATIVE MODULES (stage 4): one file per capability, each giving
 * `handlers` - IPC channel -> function - that electron/main.js registers. The page reaches them
 * only through electron/preload.js, whose allowlist names the same channels (a test checks the
 * two agree). The page's half is src/desktop/specs.
 */
const MODULES = [require('./rsagen'), require('./secrets')];

const handlers = Object.assign({}, ...MODULES.map((m) => m.handlers));

/* main.js gives each module a way to push events to the page (the spec's on<Name> emitters) */
function attach(send) {
  for (const m of MODULES) if (typeof m.attach === 'function') m.attach(send);
}

module.exports = { handlers, attach };

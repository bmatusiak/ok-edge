'use strict';
/*
 * THE CLI'S HOST, IN THE DESKTOP APP (ok-edge TODO B4b; Brad, 2026-10-23: "we treat --desktop like
 * --ble, where the desktop app does the usb talking"; "desktop and cli use the same bucket data").
 *
 * While the app runs, `onlykey-js --desktop` - and plain `onlykey-js` - reach the hard key through it:
 * node-onlykey-lib's desktop/serve.js listens on a local socket (trusted through ~/.onlykey-js/
 * desktop.json), relays the key's reports, and answers the CLI's Edge host messages with the CLI's
 * OWN host, local-host.js, and the CLI's own Edge homes in ~/.onlykey-js - one host and one set of
 * records, app or no app. What the app adds is the person's approval in THIS window (the yellow Edge
 * sheet, src/ui/DesktopHostSheet.tsx) instead of the terminal's y/N; the press is still the key's.
 *
 * THE KEY is the page's own USB pipe, shared (usbhid.shared): one open interface for both.
 *
 * THE ROUND TRIP with the page, per request:
 *   okedge:hostSay  {line, net}            what the host says (the request's view, "PRESS the key now")
 *   okedge:hostAsk  {id, net, lines, question}  the y/N, as a sheet; the window comes to the front
 *   okedge:hostAnswer (id, yes)             the page's answer (no answer in ASK_MS = no)
 *   okedge:hostDone {}                      the request is over: the sheet closes
 */
const os = require('os');
const path = require('path');
const { BrowserWindow } = require('electron');
const usbhid = require('./usbhid');

const ASK_MS = 120000;

let send = () => {};
let server = null;
let stack = null; /* the lib's stack on the shared pipe: the key's Edge service, for the host */
const hosts = {}; /* per net */
let asking = null;
let nextId = 1;

/* the CLI's Edge home for a net (edge/cli/control.js edgeHome(): ~/.onlykey-js/edge, or edge-test) */
const homeFor = (net) => path.join(os.homedir(), '.onlykey-js', net === 'test' ? 'edge-test' : 'edge');

async function edgeService() {
  if (stack) return stack.edge;
  const { startDesktop } = require('node-onlykey-lib/cli/desktop');
  const app = await startDesktop({ pipe: usbhid.shared });
  await app.services.device.connect();
  let edge = null;
  require('node-onlykey-lib/plugins/edge')({ transport: app.services.transport }, (err, s) => {
    if (err) throw err;
    edge = s.edge;
  });
  stack = { app, edge };
  return edge;
}

function front() {
  const [win] = BrowserWindow.getAllWindows();
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function hostFor(net) {
  return {
    async send(message, opts) {
      if (!hosts[net]) {
        const { createLocalHost } = require('node-onlykey-lib/edge/cli/local-host');
        const edge = await edgeService();
        let lines = [];
        hosts[net] = {
          reset: () => { lines = []; },
          host: createLocalHost({
            edge,
            home: homeFor(net),
            say: (line) => { lines.push(line); send('okedge:hostSay', { line, net }); },
            confirm: (question) => new Promise((resolve) => {
              const id = nextId++;
              const timer = setTimeout(() => { if (asking && asking.id === id) asking = null; resolve(false); }, ASK_MS);
              asking = { id, resolve: (yes) => { clearTimeout(timer); asking = null; resolve(yes); } };
              front();
              /* until: when no answer becomes a no - the sheet counts it down, as the phone's does */
              send('okedge:hostAsk', { id, net, lines: lines.slice(), question: String(question).replace(/\s*\[y\/N\]\s*$/, ''), until: Date.now() + ASK_MS });
            }),
          }),
        };
      }
      const h = hosts[net];
      h.reset();
      try {
        return await h.host.send(message, opts);
      } finally {
        send('okedge:hostDone', { net });
      }
    },
  };
}

async function start() {
  if (server) return;
  const { createDesktopServer } = require('node-onlykey-lib/desktop/serve');
  server = createDesktopServer({ pipe: usbhid.shared, hostFor, log: (l) => console.log(`[hosting] ${l}`) });
  await server.start();
}

async function stop() {
  const s = server;
  server = null;
  if (s) await s.stop().catch(() => {});
  if (stack) await Promise.resolve(stack.app.destroy()).catch(() => {});
  stack = null;
}

module.exports = {
  start,
  stop,
  attach(push) { send = push; },
  handlers: {
    'okedge:hostAnswer': (id, yes) => { if (asking && asking.id === id) asking.resolve(Boolean(yes)); return true; },
  },
};

'use strict';
/*
 * THE CLI'S HOST, IN THE DESKTOP APP (ok-edge TODO B4b; Brad, 2026-10-23: "we treat --desktop like
 * --ble, where the desktop app does the usb talking"; 2026-10-24: "i need this to be a 1 to 1 in how
 * it works" - "cli -> mobile is the same as cli -> desktopapp").
 *
 * While the app runs, `onlykey-js --desktop` - and plain `onlykey-js` - reach the hard key through it:
 * node-onlykey-lib's desktop/serve.js listens on a local socket (trusted through ~/.onlykey-js/
 * desktop.json) and relays the key's reports. The CLI's Edge host messages go to the PAGE and are
 * answered there by the phone's own host (src/hooks/useDesktopHost.ts -> edgeAgents.handleEdgeMessage),
 * exactly as a computer's messages over Bluetooth are on the phone: the same request sheet, the same
 * key code (on the desktop the hard key).
 *
 * THE KEY is the page's own USB pipe, shared (usbhid.shared): one open interface for both.
 *
 * THE ROUND TRIP with the page, per message:
 *   okedge:edgeMessage {id, message, from}   to the page: one Edge message from the CLI
 *   okedge:edgeAnswer (id, answer)           the page's answer, back to the CLI
 */
const os = require('os');
const path = require('path');
const { BrowserWindow } = require('electron');
const usbhid = require('./usbhid');

/* a budget waits for the person (2 min) and then a press: the longest a message is waited for */
const ANSWER_MS = 240000;

let send = () => {};
let server = null;
const answers = new Map(); /* message id -> resolve */
let nextId = 1;
function front() {
  const [win] = BrowserWindow.getAllWindows();
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function hostFor() {
  return {
    send(message) {
      /* a request the person answers brings the window to the front, as the phone's sheet does */
      const { request: requestLib, identity: identityLib } = require('node-onlykey-lib/edge');
      if (message && (message.type === requestLib.TYPE || message.type === identityLib.SET_TYPE)) front();
      const id = nextId++;
      return new Promise((resolve) => {
        const timer = setTimeout(() => { answers.delete(id); resolve({ ok: false, refusal: 'timeout', detail: 'the desktop app did not answer in time' }); }, ANSWER_MS);
        answers.set(id, (answer) => { clearTimeout(timer); answers.delete(id); resolve(answer); });
        send('okedge:edgeMessage', { id, message, from: os.hostname() });
      });
    },
  };
}

/*
 * THE CLI'S KEY WRITES WAIT FOR THE PAGE TO STAND ASIDE (desktop, 2026-10-24: the Edge tab's own reads
 * landed in the middle of a CLI command and the CLI misread the key). On the phone every byte goes
 * through the app's bridge, which holds the key for a computer's conversation (vendorBridge
 * createComputerHold); here the CLI's bytes go through this process, so before each write the page
 * is asked to take that same hold (after any request of its own in flight) and the write goes once
 * it says so. Host messages are not key writes: they are answered by the page itself.
 */
const holdAcks = new Map(); /* id -> resolve */
let nextHold = 1;
function pageHolds() {
  const id = nextHold++;
  return new Promise((resolve) => {
    /* no page to ask (no window yet): nothing of the page's can be in the way */
    const timer = setTimeout(() => { holdAcks.delete(id); resolve(); }, 5000);
    holdAcks.set(id, () => { clearTimeout(timer); holdAcks.delete(id); resolve(); });
    send('okedge:computerTalks', { id });
  });
}
/*
 * THE KEY THE PAGE HAS OPEN, whichever it is (Brad, 2026-10-25: "the cli should not need to know what the desktop app
 * is talking to"): a hard key on USB or the app's soft key. The page says which (okedge:activeKey, from KeyContext)
 * every time it changes; the CLI's pipe forwards to that one, and only that one's reports reach the CLI.
 * The handover runs before the CLI counts as speaking (node-onlykey-lib desktop/serve.js beforeWrite): a report
 * meanwhile is not its.
 */
let activeKey = 'usb';
const softKey = () => require('./okemu').shared;
const current = () => (activeKey === 'embedded' ? softKey() : usbhid.shared);
const cliPipe = {
  isRunning: () => current().isRunning(),
  start: () => current().start(),
  async stop() { /* the page decides when its key closes */ },
  beforeWrite: pageHolds,
  write: (iface, bytes) => current().write(iface, bytes),
  on(event, listener) {
    const offs = [usbhid.shared, softKey()].map((p) => p.on(event, (ev) => { if (p === current()) listener(ev); }));
    return () => { for (const off of offs) off(); };
  },
  get device() { return current().device; },
  interfaces: () => current().interfaces(),
};

async function start() {
  if (server) return;
  const { createDesktopServer } = require('node-onlykey-lib/desktop/serve');
  /* a CLI's whole conversation: the page holds the key for it, and lets go only to answer it (useDesktopHost) */
  server = createDesktopServer({ pipe: cliPipe, hostFor, log: (l) => console.log(`[hosting] ${l}`), onClient: (connected) => send('okedge:computerConnected', { connected }) });
  await server.start();
}

async function stop() {
  const s = server;
  server = null;
  if (s) await s.stop().catch(() => {});
}

const bucketHome = () => require('node-onlykey-lib/bucket/cli/home');

module.exports = {
  start,
  stop,
  attach(push) { send = push; },
  handlers: {
    /* the page's active key: 'usb' (a hard key) or 'embedded' (the app's soft key) */
    'okedge:activeKey': (backend) => { activeKey = backend === 'embedded' ? 'embedded' : 'usb'; return activeKey; },
    'okedge:edgeAnswer': (id, answer) => { const done = answers.get(id); if (done) done(answer); return true; },
    'okedge:computerHeld': (id) => { const done = holdAcks.get(id); if (done) done(); return true; },
    /*
     * THE IDENTITY'S BUCKET IN THE CLI'S FOLDER (Brad, 2026-10-24: "cli and desktop decrypt once, share same bucket
     * stored in filesystem"): the page's identity check opens it once with the key and keeps it here; after that the
     * page's stores read and write this file, as the CLI does - each write a locked read-modify-write, so the two
     * never drop each other's change. The lib names the file from the identity id and refuses any other name.
     */
    'okedge:bucketHas': (identity, net) => bucketHome().hasIdentityBucket(identity, net),
    'okedge:bucketKeep': (identity, net, text) =>
      bucketHome().keepIdentityBucket(identity, net, require('node-onlykey-lib/bucket').open(text, { allowUnsealed: true }).bucket),
    /*
     * THE PAGE HOLDS THE BUCKET IN MEMORY, AS EVERY PLATFORM DOES (ok-edge src/bucket/storage.desktop.ts; PROPOSAL-rectify-
     * ok-edge.md R1). It reads the file once, and writes by handing its whole bucket back to be MERGED into the file inside
     * its lock - the lib's merge with the store rules, newer wins - so a write the CLI made meanwhile is never lost. (It
     * used to send every read and write here key by key: bucketGet/Set/Entries/SetMany/Summary/Move, gone.)
     */
    'okedge:bucketRead': (identity, net) => {
      const home = bucketHome();
      if (!home.hasIdentityBucket(identity, net)) return null;
      return require('node-onlykey-lib/bucket').serialize(home.read(home.identityFile(identity, net)));
    },
    'okedge:bucketMergeIn': (identity, net, text) => {
      const lib = require('node-onlykey-lib/bucket');
      const rules = require('node-onlykey-lib/bucket/cli/trade').storeRules();
      const home = bucketHome();
      const report = home.update(home.identityFile(identity, net), (b) => {
        const { bucket, report: r } = lib.merge(b, lib.parse(text), { rules });
        b.stores = bucket.stores;
        b.clock = bucket.clock;
        return r;
      });
      return report.taken;
    },
  },
};

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
  stack = { app, edge, okcrypto: app.services.okcrypto };
  return edge;
}

/*
 * THE KEY'S IDENTITY HOME for a net (ok-edge B3.0: one identity, one store): the lib's identityHome() -
 * the same function the CLI's openDevice uses - <net home>/<identity id>, with the first-time copy of
 * the key's own records from before identities. Once per connection and net.
 */
const idHomes = {};
async function idHomeFor(net) {
  if (!idHomes[net]) {
    const edge = await edgeService();
    const { identityHome } = require('node-onlykey-lib/edge/cli/migrate-identity');
    idHomes[net] = identityHome({ edge, okcrypto: stack.okcrypto, netHome: homeFor(net), say: (l) => console.log(`[hosting] ${l}`) });
  }
  return idHomes[net];
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
            home: await idHomeFor(net),
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

/*
 * THE HARD KEY'S BUDGET HISTORY, from the shared records (Brad, 2026-10-24: "the block chain storage
 * should be loaded by the desktop app"): the copy the CLI keeps of this key's chain in ~/.onlykey-js
 * (the live home, or the testnet's - whichever holds this device), told as budgets by the lib's
 * edge/src/history.js. The key is asked only for its device id (it must be unlocked) - ONCE per
 * connection: the page refreshes this every few seconds while a budget is live, and a read slipped
 * between the CLI's commands (a ship goes through this app) must not happen; a refresh reads the
 * shared records only. The id goes when the key does (unplugged, restarted).
 */
let keyIdHex = null;
usbhid.shared.on('close', () => {
  keyIdHex = null;
  /* the stack on the old pipe is spent: the next request opens a fresh one */
  if (stack) { Promise.resolve(stack.app.destroy()).catch(() => {}); stack = null; }
  for (const k of Object.keys(hosts)) delete hosts[k];
  for (const k of Object.keys(idHomes)) delete idHomes[k];
});

async function hardKeyHistory() {
  if (!keyIdHex) {
    const edge = await edgeService();
    const { deviceId } = await edge.publicKey();
    keyIdHex = Buffer.from(deviceId).toString('hex');
  }
  const idHex = keyIdHex;
  const bucket = require('node-onlykey-lib/bucket/cli/home');
  const { history } = require('node-onlykey-lib/edge');
  const names = require('node-onlykey-lib/edge/cli/nametag');
  /*
   * EVERY DEVICE OF THIS KEY'S IDENTITY (Brad, 2026-10-24: "sync so each team knows the budget history
   * if using the same key identity - any combo of phones and hard keys"): the identity's records hold a
   * copy per device - this key's, and each phone's or hard key's that edge sync brought in - and only
   * that identity's (B3.0). This key first, then the others, each under its name: the nametag kept here,
   * else the one in its own signed statement.
   */
  const net = await netOfKey();
  const home = await idHomeFor(net);
  const kv = bucket.kv(bucket.edgeAt(home, 'copies'));
  const devices = [];
  for (const k of kv.keys()) {
    let c = null;
    try { c = JSON.parse(kv.getItem(k)); } catch (_) { continue; }
    const id = String(c.deviceId || k);
    const kept = names.getName(home, id);
    devices.push({
      deviceId: id, self: id === idHex, links: (c.links || []).length,
      name: kept ? kept.nametag : (c.statement && c.statement.nametag) || null,
      history: history.budgetHistory(c),
    });
  }
  devices.sort((a, b) => (b.self - a.self) || (b.links - a.links));
  const mine = devices.find((d) => d.self);
  return { deviceId: idHex, net, links: mine ? mine.links : 0, history: mine ? mine.history : null, devices };
}

/*
 * "MY DEVICE NAME" for the hard key (Brad, 2026-10-24: "the desktop app i should be able to set it in
 * the edge manage popup tab"): the lib's nametag.js - the same function as `onlykey-js edge name` - on
 * the key's identity home. The net is the one whose records hold this key's chain (key 1: live, key 2:
 * the testnet), the live one when neither does yet.
 */
async function netOfKey() {
  if (!keyIdHex) {
    const edge = await edgeService();
    keyIdHex = Buffer.from((await edge.publicKey()).deviceId).toString('hex');
  }
  const bucket = require('node-onlykey-lib/bucket/cli/home');
  for (const net of ['live', 'test']) {
    if (bucket.kv(bucket.edgeAt(await idHomeFor(net), 'copies')).getItem(keyIdHex.slice(0, 16))) return net;
  }
  return 'live';
}

async function hardKeyName() {
  const net = await netOfKey();
  const home = await idHomeFor(net);
  const names = require('node-onlykey-lib/edge/cli/nametag');
  const mine = names.getName(home, keyIdHex);
  return { deviceId: keyIdHex, net, nametag: mine ? mine.nametag : null, at: mine ? mine.at : null, others: names.listNames(home).filter((n) => n.deviceId !== keyIdHex) };
}

/* the agent identity record the CLI's host keeps in the key's identity (local-host.js identityKv) - for the drawer's Agent identity card */
async function hardKeyIdentity() {
  const home = await idHomeFor(await netOfKey());
  const t = require('node-onlykey-lib/edge/cli/local-host').identityKv(home).getItem('record');
  return { record: t ? JSON.parse(t) : null };
}

/*
 * The key's chain copy as blocks (the lib's copy.blocks - the same as `onlykey-js edge blocks`): cut at
 * the key's seals, each verified - read from the identity's records only, never the key.
 */
async function hardKeyBlocks() {
  const net = await netOfKey();
  const home = await idHomeFor(net);
  const found = require('node-onlykey-lib/edge/cli/copy').blocks(home, { net: net === 'test' ? 'test' : 'live' });
  return {
    devices: found.map((d) => ({
      deviceId: d.deviceId, open: d.open, reason: d.reason || null,
      blocks: d.blocks.map((b) => ({ from: b.block.start.seq, to: b.block.checkpoint.seq, links: b.block.links.length, id: b.id, ok: b.ok, reason: b.reason || null })),
    })),
  };
}

/*
 * THE KEY'S OWN LINKS FROM THE SHARED RECORDS (Brad, 2026-10-24: "i need this to be a 1 to 1"): the
 * desktop runs the phone's Edge tab on the hard key, and the key holds only its newest links. What
 * the CLI picked up before is in ~/.onlykey-js - this computer's copy - and is offered to the tab's
 * copy the way a computer offers links to a phone (edgeStore.mergeOffered: checked against the key,
 * kept only if it verifies). Records only, never the key. -> [[link, head, reveal|null]] hex
 */
async function sharedLinks(deviceIdHex) {
  /* the identity home that holds this device's copy - found in the records, so the tab stays the key's only reader */
  const fs = require('fs');
  const bucket = require('node-onlykey-lib/bucket/cli/home');
  const id = String(deviceIdHex).toLowerCase();
  const homes = ['live', 'test'].flatMap((net) => {
    const base = homeFor(net);
    try { return fs.readdirSync(base).filter((d) => /^[0-9a-f]{32}$/.test(d)).map((d) => path.join(base, d)); } catch (_) { return []; }
  });
  const home = homes.find((h) => bucket.kv(bucket.edgeAt(h, 'copies')).getItem(id.slice(0, 16)));
  if (!home) return [];
  const c = require('node-onlykey-lib/edge/cli/copy').load(home, Buffer.from(id, 'hex'));
  const hex = (b) => Buffer.from(b).toString('hex');
  return (c.links || []).map((r) => [hex(r.link), hex(r.head), r.reveal ? hex(r.reveal) : null]);
}

async function hardKeySetName(nametag) {
  const net = await netOfKey();
  const home = await idHomeFor(net);
  const r = await require('node-onlykey-lib/edge/cli/nametag').setName({ edge: await edgeService(), home, nametag });
  return { ...r, net };
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
    'okedge:hardKeyHistory': () => hardKeyHistory().catch((e) => ({ error: (e && e.message) || String(e) })),
    'okedge:hardKeyName': () => hardKeyName().catch((e) => ({ error: (e && e.message) || String(e) })),
    'okedge:hardKeyIdentity': () => hardKeyIdentity().catch((e) => ({ error: (e && e.message) || String(e) })),
    'okedge:hardKeyBlocks': () => hardKeyBlocks().catch((e) => ({ error: (e && e.message) || String(e) })),
    'okedge:sharedLinks': (deviceIdHex) => sharedLinks(deviceIdHex).catch(() => []),
    'okedge:hardKeySetName': (nametag) => hardKeySetName(nametag).catch((e) => ({ error: (e && e.message) || String(e) })),
  },
};

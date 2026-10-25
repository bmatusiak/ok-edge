'use strict';

/**
 * THE SYNC SERVICE, HOSTED BY THE DESKTOP APP WHILE IT RUNS (Brad, 2026-10-25: "desktop app will run the service while
 * it's alive"; "the service can bluetooth stuff - this means the desktop app can use bluetooth in this area while it's
 * open"; "this service is a sync service").
 *
 * The phone HOSTS Bluetooth (it advertises; a computer reaches it). The desktop does not - it reaches the phones this
 * computer is cli-paired with, as `onlykey-js --ble` does. So the service here IS the lib's: `onlykey-js --ble --service`
 * (the Edge agent with the sync service in it, node-onlykey-lib bucket/cli/service.js), started as a child with plain
 * Node, never re-written for Electron:
 *   - one logic: the trade that works from the CLI is the trade the desktop runs;
 *   - the Bluetooth stack (the noble fork) is a native module built for Node, not for Electron's ABI - in a Node child it
 *     loads as it does for the CLI (the soft key runs the same way, okemu.js).
 *
 * The page says which net the app is on once its bucket is open (okedge:syncNet) and the child runs for that net. Pairing
 * a new phone from the Sync tab is `onlykey-js --ble pair` the same way: the code it prints goes to the page, to compare
 * with the phone's. Both use the one Bluetooth radio, so the service is paused while a pairing runs.
 *
 * Only the cli pair's public facts reach the page - the phone's name, address and id, when it was renewed. The pair
 * secret (`ps`) stays in ~/.onlykey-js/cli-pairing.json.
 */
const { spawn } = require('child_process');
const readline = require('readline');

/* a service that ended (no phone in range, the radio off) is started again after this long */
const RETRY_MS = 60 * 1000;
/* the lines of a run kept for the page */
const KEEP_LINES = 40;

let send = () => {};
let wantNet = null;
let child = null;
let retry = null;
let pairing = null;
let cancelled = false;
/* the stores the running trade took changes into (its "sync: took" lines), said to the page when it ends */
const tookStores = new Set();
/* the stores it gave to (its "sync: giving" lines): with the took ones, the stores a sync changed */
const gaveStores = new Set();
let state = { role: 'computer', enabled: true, service: 'off', net: null, last: null, trading: false, stores: {}, took: null, lines: [], pair: null };

const store = () => require('node-onlykey-lib/cli/clipair-store');

/*
 * SYNC CAN BE TURNED OFF (Brad, 2026-10-25: "sync can be disabled"), and it stays as the person left it: the switch is
 * kept in this app's own folder. On unless turned off - the paired phones are the person's own, paired on purpose.
 */
const fs = require('fs');
const path = require('path');
const settingFile = () => path.join(require('electron').app.getPath('userData'), 'sync.json');
function readEnabled() {
  try { return JSON.parse(fs.readFileSync(settingFile(), 'utf8')).enabled !== false; } catch { return true; }
}
let enabledRead = false;

function peers() {
  return store().list().map((p) => ({
    name: p.phoneName || null,
    address: p.address || null,
    phoneId: String(p.phoneId || '').slice(0, 8) || null,
    renewedAt: p.renewedAt || null,
    /* the phone side's row facts, so the one card shows the same (src/ui/PairedDevicesCard.tsx) */
    code: p.code || null,
    lastUsed: p.lastUsed || null,
    on: !p.off,
  }));
}

function snapshot() {
  if (!enabledRead) { enabledRead = true; state.enabled = readEnabled(); }
  return { ...state, peers: peers() };
}

function changed(next) {
  state = { ...state, ...next };
  send('okedge:syncChanged', snapshot());
}

/*
 * WHICH CLI: the lib this app is built with. Its Bluetooth stack (the noble fork on Windows, dbus-next on Linux) is the
 * lib's optional peer, never downloaded with it - so the web app and ok-rn carry nothing native - and this app lists
 * it as its own (package.json optionalDependencies; Brad, 2026-10-25), so the lib inside the app reaches the phone.
 * OKEDGE_CLI (a path to a node-onlykey-lib checkout's cli/index.js) is a developer's override.
 */
const cliEntry = () => process.env.OKEDGE_CLI || require.resolve('node-onlykey-lib/cli/index');

/* the lib's CLI with plain Node - the ELECTRON_RUN_AS_NODE of this process is not passed on */
function runCli(args, onLine) {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  /* how this app's sync service is named to a second one on this computer (lib bucket/cli/service.js's lock) */
  env.OKEDGE_SYNC_WHO = 'the desktop app';
  const proc = spawn(process.env.OKEDGE_NODE || 'node', [cliEntry(), ...args], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    /* Windows gives a console program started from a GUI app a console window of its own */
    windowsHide: true,
  });
  for (const s of [proc.stdout, proc.stderr]) readline.createInterface({ input: s }).on('line', onLine);
  return proc;
}

function keep(line) {
  console.log(`[sync] ${line}`);
  return [...state.lines, line].slice(-KEEP_LINES);
}

function startService() {
  clearTimeout(retry);
  retry = null;
  if (child || pairing || !wantNet) return;
  if (!snapshot().enabled) { changed({ service: 'off', net: wantNet }); return; }
  if (!peers().length) { changed({ service: 'no-peers', net: wantNet }); return; }
  const net = wantNet;
  /*
   * the lib's service with this app as its key (the plain CLI reaches a running desktop app): it opens its own Bluetooth
   * link to each phone this computer is cli-paired with and has switched on (the Sync tab's toggles)
   */
  const proc = runCli(['--service', ...(net === 'test' ? ['--test-mode'] : [])], (line) => {
    if (child !== proc) return;
    /*
     * The sync service's own lines (node-onlykey-lib bucket/cli/service.js, bucket/cli/trade.js), after the agent's
     * "edge: " prefix:
     *   "sync: trading - ..."          records are moving: the icon flashes
     *   "sync: took {...}"             what this computer took, per store: the page's screens holding a decrypted copy
     *                                  of one ask to decrypt again (src/bucketEvents.ts)
     *   "sync: in sync" / "traded"     it reached the phone: the last sync, green
     *   "sync: not traded"             it did not
     *   "sync: runs in pid N (who)"    another sync service on this computer has it (the lib's one-per-computer lock)
     */
    const s = line.replace(/^edge: /, '');
    const took = /^sync: took (\{.*\})$/.exec(s);
    const giving = /^sync: giving (\{.*\})/.exec(s);
    const storesLine = /^sync: stores (\{.*\})$/.exec(s);
    const elsewhere = /^sync: runs in pid (\d+) \((.*)\)/.exec(s);
    if (elsewhere) {
      /*
       * not ours to run: this child would only hold a Bluetooth link to the same phone - and a phone answers the computer
       * that connected last. It goes; whether the other one still runs is looked at again later.
       */
      changed({ lines: keep(line), service: 'elsewhere', elsewhere: `${elsewhere[2]}, pid ${elsewhere[1]}` });
      child = null;
      proc.kill();
      retry = setTimeout(startService, RETRY_MS);
    } else if (/^sync: trading\b/.test(s)) changed({ lines: keep(line), trading: true });
    else if (giving) {
      try { for (const st of Object.keys(JSON.parse(giving[1]))) gaveStores.add(st); } catch { /* not a count line */ }
      changed({ lines: keep(line) });
    } else if (storesLine) {
      /* each feature after the trade: its items, whether it matches; a store this trade took into or gave from changed now */
      let now = {};
      try { now = JSON.parse(storesLine[1]); } catch { /* not a stores line */ }
      const at = Date.now();
      const stores = {};
      for (const [name, x] of Object.entries(now)) {
        const moved = tookStores.has(name) || gaveStores.has(name);
        stores[name] = { items: x.items, same: x.same, checkedAt: at, changedAt: moved ? at : ((state.stores || {})[name] || {}).changedAt || null };
      }
      gaveStores.clear();
      changed({ lines: keep(line), stores });
    }
    else if (took) {
      /* held until the trade ends: the CLI writes the kept file after its last round, and a screen reading it now would read it old */
      try { for (const st of Object.keys(JSON.parse(took[1]))) tookStores.add(st); } catch { /* not a count line */ }
      changed({ lines: keep(line) });
    } else if (/^sync: (in sync|(not )?traded)\b/.test(s)) {
      const stores = [...tookStores];
      tookStores.clear();
      changed({
        lines: keep(line), trading: false,
        last: { line: s, at: Date.now(), ok: !/^sync: not traded\b/.test(s) && !/NOT settled/.test(s) },
        ...(stores.length ? { took: { stores, at: Date.now() } } : {}),
      });
    } else changed({ lines: keep(line) });
  });
  child = proc;
  changed({ service: 'running', net, trading: false, lines: [] });
  proc.once('error', (e) => { if (child === proc) changed({ lines: keep(`the sync service did not start: ${e.message}`) }); });
  proc.once('exit', (code) => {
    if (child !== proc) return;
    child = null;
    changed({ service: 'stopped', trading: false, lines: keep(`the sync service ended (${code})`) });
    /* still wanted: once more later (a phone out of range now is in range later) */
    if (wantNet && !pairing) retry = setTimeout(startService, RETRY_MS);
  });
}

/* stop the service's child; the promise settles once it has exited (killed outright if it lingers) */
function stopService() {
  clearTimeout(retry);
  retry = null;
  const proc = child;
  child = null;
  if (!proc || proc.exitCode !== null || proc.signalCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    const hard = setTimeout(() => { try { proc.kill('SIGKILL'); } catch { /* gone */ } }, 8000);
    proc.once('exit', () => { clearTimeout(hard); resolve(); });
    proc.kill();
  });
}

/* the page's net, once its bucket is open; null when the app locks */
function setNet(net) {
  const next = net === 'test' || net === 'live' ? net : null;
  if (next === wantNet && (child || pairing)) return snapshot();
  stopService();
  wantNet = next;
  if (!next) changed({ service: 'off', net: null });
  else startService();
  return snapshot();
}

/* a paired phone switched on or off here (off: the service leaves it alone; the lib reads it each trade) */
function setOn(address, on) {
  store().setOn(address, on !== false);
  changed({});
  return snapshot();
}

function setEnabled(on) {
  const enabled = on !== false;
  try { fs.writeFileSync(settingFile(), JSON.stringify({ enabled })); } catch (e) { console.error(`[sync] could not keep the switch: ${e.message}`); }
  enabledRead = true;
  state.enabled = enabled;
  if (!enabled) { stopService(); changed({ service: 'off', trading: false }); } else startService();
  return snapshot();
}

/*
 * PAIR A PHONE, FROM THE APP (Brad, 2026-10-25: "this is where we can pair a new device (phone) without cli"): the lib's
 * cli-pair 6-digit flow, `onlykey-js --ble pair`. Its lines go to the page; the code line is picked out to show large.
 */
/*
 * The service's child is let go FIRST, and the pairing starts only once it has exited and the link has settled (the box,
 * 2026-10-25: the two overlapped - the service's child said goodbye as the pairing's first message went out, and its
 * exit took the computer's one Bluetooth connection to the phone down 2 s later; the phone's approval then found "the
 * target is not connected" and the pairing window closed).
 */
const SETTLE_MS = 1500;
async function pairPhone() {
  if (pairing) return snapshot();
  cancelled = false;
  pairing = 'starting';
  changed({ pair: { running: true, code: null, line: 'letting the sync service go first', ok: null, startedAt: Date.now(), codeAt: null }, lines: [] });
  await stopService();
  await new Promise((res) => setTimeout(res, SETTLE_MS));
  if (cancelled) { pairing = null; changed({ pair: null }); startService(); return snapshot(); }
  const proc = runCli(['--ble', 'pair'], (line) => {
    const code = /^code\s+(\d{6})\b/.exec(line);
    changed({ lines: keep(line), pair: { ...state.pair, ...(code ? { code: code[1], codeAt: Date.now() } : {}), line } });
  });
  pairing = proc;
  changed({ pair: { running: true, code: null, line: null, ok: null, startedAt: Date.now(), codeAt: null } });
  const done = (ok, why) => {
    if (pairing !== proc) return;
    pairing = null;
    /* a pairing the person cancelled is no failure to show */
    changed({ pair: cancelled ? null : { ...state.pair, running: false, ok, ...(why ? { line: why } : {}) } });
    startService();
  };
  proc.once('error', (e) => done(false, `could not start the pairing: ${e.message}`));
  proc.once('exit', (code) => done(code === 0));
  return snapshot();
}

function cancelPair() {
  if (pairing) { cancelled = true; if (pairing !== 'starting') pairing.kill(); }
  return snapshot();
}

/* forget a phone here (the phone forgets this computer on its own Bluetooth tab) */
function forget(address) {
  store().removePairing(address);
  if (!peers().length) stopService();
  changed({});
  return snapshot();
}

module.exports = {
  attach(push) { send = push; },
  stop: async () => { wantNet = null; await stopService(); if (pairing && pairing !== 'starting') pairing.kill(); },
  handlers: {
    'okedge:syncState': () => snapshot(),
    'okedge:syncNet': (net) => setNet(net),
    'okedge:syncEnable': (on) => setEnabled(on),
    'okedge:syncSetOn': (address, on) => setOn(address, on),
    'okedge:syncPair': () => pairPhone(),
    'okedge:syncPairCancel': () => cancelPair(),
    'okedge:syncForget': (address) => forget(address),
  },
};

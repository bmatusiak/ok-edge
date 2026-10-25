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
let state = { enabled: true, service: 'off', net: null, last: null, trading: false, lines: [], pair: null };

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
 * WHICH CLI: OKEDGE_CLI (a path to a node-onlykey-lib checkout's cli/index.js), else the lib this app is built with.
 * The lib does not list its Bluetooth stack as a dependency (dbus-next on Linux, @stoprocent/noble on Windows - each
 * installed by hand into the CLI's own checkout), so the copy inside this app cannot reach a phone; the person's CLI
 * can. Until the lib lists them, a desktop that syncs is started with OKEDGE_CLI set.
 */
const cliEntry = () => process.env.OKEDGE_CLI || require.resolve('node-onlykey-lib/cli/index');

/* the lib's CLI with plain Node - the ELECTRON_RUN_AS_NODE of this process is not passed on */
function runCli(args, onLine) {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
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
  const proc = runCli(['--ble', '--service', ...(net === 'test' ? ['--test-mode'] : [])], (line) => {
    if (child !== proc) return;
    /*
     * The sync service's own lines (node-onlykey-lib bucket/cli/service.js): "sync: trading" when one starts (the icon
     * flashes), "sync: traded" / "sync: not traded" when it ends - the page's last sync, and whether it reached the phone. The
     * agent prefixes its own logs with "edge: ", so the line is matched after that.
     */
    if (/^(edge: )?sync: trading\b/.test(line)) changed({ lines: keep(line), trading: true });
    else if (/^(edge: )?sync: (not )?traded\b/.test(line)) {
      changed({ lines: keep(line), trading: false, last: { line, at: Date.now(), ok: /^(edge: )?sync: traded\b/.test(line) } });
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

function stopService() {
  clearTimeout(retry);
  retry = null;
  const proc = child;
  child = null;
  if (proc) proc.kill();
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
function pairPhone() {
  if (pairing) return snapshot();
  stopService();
  cancelled = false;
  const proc = runCli(['--ble', 'pair'], (line) => {
    const code = /^code\s+(\d{6})\b/.exec(line);
    changed({ lines: keep(line), pair: { ...state.pair, ...(code ? { code: code[1], codeAt: Date.now() } : {}), line } });
  });
  pairing = proc;
  changed({ pair: { running: true, code: null, line: null, ok: null, startedAt: Date.now(), codeAt: null }, lines: [] });
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
  if (pairing) { cancelled = true; pairing.kill(); }
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
  stop: async () => { wantNet = null; stopService(); if (pairing) pairing.kill(); },
  handlers: {
    'okedge:syncState': () => snapshot(),
    'okedge:syncNet': (net) => setNet(net),
    'okedge:syncEnable': (on) => setEnabled(on),
    'okedge:syncPair': () => pairPhone(),
    'okedge:syncPairCancel': () => cancelPair(),
    'okedge:syncForget': (address) => forget(address),
  },
};

'use strict';
/*
 * THE PI RELAY KEY - OPTIONAL (Brad, 2026-11-02: "now we have a FAKE real looking key that you can control and inspect";
 * "rehearsals dont see the pi or its proxy service - an optional way to help debug, test and pen test"; "the drive will
 * see the pi as an optional tool also, so another developer may not have a pi on hand").
 *
 * A test soft key whose firmware runs HERE (node-onlykey-emulator, OKEMU_BRIDGE=remote) and whose USB body is a Raspberry
 * Pi's gadget plugged into another computer (the emulator's bin/relay.js on the Pi): that computer's apps see a real
 * OnlyKey, and this machine presses its buttons, reads its LED, plugs and unplugs its cable, and captures every report.
 *
 * OFF unless this machine's ~/.onlykey-drive.json says otherwise - never in the repo (the rig and its addresses are one
 * developer's):
 *   { "piKey": { "relay": "<pi>:8795", "store": "<dir of a testnet soft key copy>", "socket": "/tmp/okemu-pi.sock",
 *                "capture": "<file>" } }                       - on the machine that runs the firmware
 *   { "piKey": { "for": "desktop", "firmwareOn": "<that machine's name>" } }
 *                                                              - on the machine whose app has it on its USB
 *     (server.js procFor sends that app's key actions - press, key-state, pikey-* - to the firmware's machine)
 * Its state reads as the gadget's does - "the testnet soft key (pi relay): connected; led #rrggbb for N s" - so the
 * drive's login unlocks it from outside the same way (flows.js unlockOutsideKey).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFileSync } = require('child_process');

const SETTINGS = path.join(os.homedir(), '.onlykey-drive.json');

/** this machine's Pi key settings, or null - the tool is off */
function piKeySettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS, 'utf8')).piKey || null; } catch { return null; }
}

function createPiKey({ EMU, NODE, LOGS, line }) {
  let host = null;
  let up = false;
  let cable = null;
  let led = { hex: null, at: 0 };
  const plugWaiters = new Set();
  const conf = () => {
    const c = piKeySettings();
    if (!c || !c.relay || !c.store || !c.socket) throw new Error(`no Pi key on this machine (${SETTINGS} piKey: relay, store, socket) - it is an optional tool`);
    return c;
  };

  /* the daemon dials the socket; the drive holds it (as it holds the gadget's) - so presses go at once */
  function hold(c) {
    if (host) return;
    const IpcHost = require(path.join(EMU, 'lib', 'ipc-host'));
    const h = new IpcHost({ socketPath: c.socket });
    h.listen();
    host = h;
    h.on('device-connect', () => { up = true; line('[pi key] its firmware connected'); });
    h.on('device-disconnect', () => { up = false; line('[pi key] its firmware went'); });
    h.on('led', (m) => {
      const hex = (m.pixels || []).map((p) => `#${[p.r, p.g, p.b].map((v) => v.toString(16).padStart(2, '0')).join('')}`).join(' ');
      if (hex !== led.hex) led = { hex, at: Date.now() };
    });
    h.on('plugged', (m) => { cable = !!(m && m.plugged); for (const w of [...plugWaiters]) w(cable); });
  }

  /* its daemon, by the socket on its command line - ours or one started by hand */
  const daemons = (c) => {
    try {
      return execFileSync('pgrep', ['-f', `daemon.js .*--socket ${c.socket}`], { encoding: 'utf8' }).split('\n').filter(Boolean).map(Number);
    } catch { return []; }
  };

  async function start() {
    const c = conf();
    hold(c);
    if (daemons(c).length) return `its firmware already runs (${c.relay})`;
    const log = fs.openSync(path.join(LOGS, 'pi-softkey.log'), 'a');
    const child = spawn(NODE, ['bin/daemon.js', '--storage', c.store, '--socket', c.socket], {
      cwd: EMU, detached: true, stdio: ['ignore', log, log],
      env: { ...process.env, OKEMU_BRIDGE: 'remote', OKEMU_RELAY: c.relay, ...(c.capture ? { OKEMU_CAPTURE: c.capture } : {}) },
    });
    child.unref();
    for (let i = 0; i < 40 && !up; i++) await new Promise((ok) => setTimeout(ok, 250));
    return up ? `its firmware started (${c.relay})` : 'its firmware started - not connected to the drive yet';
  }

  async function stop() {
    const c = conf();
    const pids = daemons(c);
    for (const p of pids) { try { process.kill(p, 'SIGTERM'); } catch { /* gone */ } }
    return pids.length ? `its firmware stopped (pid ${pids.join(', ')})` : 'its firmware was not running';
  }

  async function keyState() {
    const c = conf();
    hold(c);
    const age = led.at ? Math.round((Date.now() - led.at) / 1000) : 0;
    return `the testnet soft key (pi relay): ${up ? 'connected' : 'not connected'}; led ${led.hex || 'unknown'} for ${age} s; cable ${cable === null ? 'unknown' : cable ? 'in' : 'out'}`;
  }

  async function press({ buttons = ['1'] } = {}) {
    hold(conf());
    if (!up) throw new Error('the Pi key\'s firmware is not connected - run.js pikey start');
    const b = (Array.isArray(buttons) ? buttons : String(buttons).split(/\s+/)).filter((x) => /^[1-6]$/.test(x));
    if (!b.length) b.push('1');
    for (const x of b) host.press(Number(x), 'tap');
    return `pressed ${b.join(' ')} on the pi relay key`;
  }

  /* the cable: what Windows sees as the key unplugged and plugged in (the Pi's gadget unbound and bound) */
  async function setCable(want) {
    hold(conf());
    if (!up) throw new Error('the Pi key\'s firmware is not connected - run.js pikey start');
    const moved = new Promise((ok) => {
      const t = setTimeout(() => { plugWaiters.delete(w); ok(null); }, 8000);
      function w(now) { if (now === want) { clearTimeout(t); plugWaiters.delete(w); ok(now); } }
      plugWaiters.add(w);
    });
    host._send({ t: 'setPlugged', plugged: want });
    const now = await moved;
    if (now === null) throw new Error(`the cable did not go ${want ? 'in' : 'out'} within 8 s`);
    return `the cable is ${want ? 'in' : 'out'}`;
  }

  return { start, stop, keyState, press, cable: setCable };
}

module.exports = { createPiKey, piKeySettings, SETTINGS };

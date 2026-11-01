/*
 * THE ROOM OVER BLUETOOTH (ok-edge plan B2): the localhost service with `ble`, in this process, its Bluetooth link a fake
 * one whose phone end is node-onlykey-lib's createSocketLink - the class the phone app hands connectRoom - so the room
 * client runs unchanged over it. No radio: what is under test is the server's side (ble.js, plugin.js attach, core
 * room.js's origin rule) and the socket messages both ways.
 *
 *   - the phone learns the server's name (HERE) and dials ble://<it>
 *   - a join with a kept certificate is REFUSED over Bluetooth even with OPEN_JOIN and REQUIRE_LOGIN off - only a login
 *     proof for this connection's challenge enters
 *   - with one, the phone is in the identity's room beside a websocket device, and frames pass both ways
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { identity, dev, bid } = require('./helpers');
const { connectRoom } = require('node-onlykey-lib/bucket').roomClient;
const bleSocket = require('node-onlykey-lib/transport/ble-socket');

const randomBytes = (n) => new Uint8Array(crypto.randomBytes(n));

/*
 * One fake Bluetooth link: the server's end is what cli/ble-link's createBleLink returns (open, send, on, close), the
 * phone's end a createSocketLink. The first createLink call gets it; later ones (the server opening again after a drop)
 * wait until stopped.
 */
function fakeBluetooth() {
  const listeners = { message: new Set(), down: new Set() };
  let up = false;
  const phone = bleSocket.createSocketLink({
    sendFrame: (payload) => setImmediate(() => { if (up) for (const l of listeners.message) l({ command: bleSocket.CMD_SOCKET, bytes: Uint8Array.from(payload) }); }),
  });
  const link = {
    async open() { up = true; return { address: '24:29:34:86:EA:AF', name: 'Pixel 6a', mtu: 517 }; },
    async send(command, bytes) { if (!up) throw new Error('down'); setImmediate(() => phone.push(bytes)); },
    on(ev, fn) { listeners[ev].add(fn); return () => listeners[ev].delete(fn); },
    async close() { up = false; },
    isUp: () => up,
    get phone() { return up ? { address: '24:29:34:86:EA:AF', name: 'Pixel 6a', mtu: 517 } : null; },
  };
  let made = 0;
  const createLink = () => {
    made += 1;
    if (made === 1) return link;
    return { open: () => new Promise(() => {}), on: () => () => {}, close: async () => {}, send: async () => {} };
  };
  return { createLink, phone, drop() { up = false; for (const l of listeners.down) l('dropped'); phone.down('dropped'); } };
}

async function server(t, bt) {
  const Rectify = (await import('@bmatusiak/rectify')).default;
  const core = (await import('../src/core/plugin.js')).default;
  const localhost = (await import('../src/localhost/plugin.js')).default;
  const app = Rectify.build([core, localhost]);
  await app.start();
  const lines = [];
  /* the open join on AND the login not required - Bluetooth must still ask for the proof */
  const s = await app.services.mcpLocalhost.start({ port: 0, env: { REQUIRE_LOGIN: '0', OPEN_JOIN: '1' }, ble: { createLink: bt.createLink, host: 'box.ble', log: (l) => lines.push(l) } });
  t.after(() => s.close());
  return { s, lines };
}

const hereFrom = (phone) => (phone.host ? Promise.resolve(phone.host) : new Promise((resolve) => phone.onHere(resolve)));

test('Bluetooth: the phone learns the server\'s name; a kept certificate is refused even with the open join on', async (t) => {
  const bt = fakeBluetooth();
  const { lines } = await server(t, bt);
  const host = await hereFrom(bt.phone);
  assert.equal(host, 'box.ble');
  assert.ok(lines.some((l) => /linked to Pixel 6a/.test(l)), lines.join(' | '));
  const me = await identity('ble-kept');
  await assert.rejects(
    () => connectRoom({ url: `ble://${host}`, me, device: dev('Phone', 'android'), WebSocket: bt.phone.WebSocket, randomBytes, timeoutMs: 5000 }),
    /refused the join|closed before the join/,
  );
});

test('Bluetooth: with a login proof the phone joins its room beside a websocket device, and frames pass both ways', async (t) => {
  const bt = fakeBluetooth();
  const { s } = await server(t, bt);
  const host = await hereFrom(bt.phone);
  /* the identity, its key able to sign the login proof (helpers' seed key) */
  const seed = 'ble-login';
  const me = await identity(seed);
  const key = keyOf(seed);
  const login = (asked) => bid.signLogin(key, me.identityPublicKey, me.bucketKey.publicKey, asked);
  const phone = await connectRoom({ url: `ble://${host}`, me, device: dev('Phone', 'android'), WebSocket: bt.phone.WebSocket, randomBytes, login, timeoutMs: 5000 });
  assert.ok(phone.you);
  /* a computer of the same identity over the websocket (the open join lets this computer's own 127.0.0.1 in) */
  const desk = await connectRoom({ url: s.url, me, device: dev('Desktop', 'desktop'), WebSocket: globalThis.WebSocket, randomBytes, timeoutMs: 5000 });
  assert.deepEqual(desk.peers().map((p) => p.name), ['Phone']);
  phone.serve(async (from, m) => ({ echo: m.ping, over: 'bluetooth' }));
  desk.serve(async (from, m) => ({ echo: m.ping, over: 'websocket' }));
  assert.deepEqual(await desk.request(phone.you, { ping: 1 }, { timeoutMs: 5000 }), { echo: 1, over: 'bluetooth' });
  assert.deepEqual(await phone.request(desk.you, { ping: 2 }, { timeoutMs: 5000 }), { echo: 2, over: 'websocket' });
  /* a long message (the sealed copy's size) crosses in pieces */
  const big = 'r'.repeat(20000);
  desk.serve(async (from, m) => ({ len: m.big.length }));
  assert.deepEqual(await phone.request(desk.you, { big }, { timeoutMs: 5000 }), { len: 20000 });
  phone.close();
  desk.close();
});

test('Bluetooth: the link going closes the phone\'s socket - the room hears it gone', async (t) => {
  const bt = fakeBluetooth();
  const { s } = await server(t, bt);
  const host = await hereFrom(bt.phone);
  const seed = 'ble-drop';
  const me = await identity(seed);
  const key = keyOf(seed);
  const login = (asked) => bid.signLogin(key, me.identityPublicKey, me.bucketKey.publicKey, asked);
  const phone = await connectRoom({ url: `ble://${host}`, me, device: dev('Phone', 'android'), WebSocket: bt.phone.WebSocket, randomBytes, login, timeoutMs: 5000 });
  const desk = await connectRoom({ url: s.url, me, device: dev('Desktop', 'desktop'), WebSocket: globalThis.WebSocket, randomBytes, timeoutMs: 5000 });
  const left = new Promise((resolve) => desk.on('peer', (e) => { if (e.down === phone.you) resolve(); }));
  bt.drop();
  await left;
  assert.deepEqual(desk.peers(), []);
  desk.close();
});

/* the helpers' seed key, as identity() builds it - its agent signs with the identity label's secret */
function keyOf(seed) {
  const path = require('path');
  const lib = path.dirname(require.resolve('node-onlykey-lib/package.json'));
  const { sha256 } = require(path.join(lib, 'src/vendor/exports/@noble/hashes/sha2.js'));
  const { ed25519 } = require(path.join(lib, 'src/vendor/exports/@noble/curves/ed25519.js'));
  const secretOf = (label, keyType) => sha256(new Uint8Array([...new TextEncoder().encode(seed), ...label, keyType]));
  return { agent: { sign: async (label, message) => ed25519.sign(message, secretOf(label, 1)) } };
}

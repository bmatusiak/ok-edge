/*
 * THE ROOM OVER BLUETOOTH (ok-edge plan B2): the localhost service with `ble`, in this process, its Bluetooth link a fake
 * one whose phone end is node-onlykey-lib's createSocketLink - the class the phone app hands connectRoom - so the room
 * client runs unchanged over it. No radio: what is under test is the server's side (ble.js, plugin.js attach, core
 * room.js's origin rule) and the socket messages both ways.
 *
 *   - the phone learns the server's name (HERE) and dials ble://<it>
 *   - a join with a kept certificate is REFUSED over Bluetooth even with OPEN_JOIN and REQUIRE_LOGIN off - only a login
 *     proof for this connection's challenge enters
 *   - with one, the phone is in the identity's room beside a websocket device, and frames pass both ways; this computer
 *     learns which room the phone is in (/ble)
 *   - the phone's app starting over under a link that stays up (WHERE, no socket open) closes its dead socket
 *   - onlykey-js --ble (node-onlykey-lib cli/ble-room.js): this computer comes into that room as an agent, waits for the
 *     owner's accept on the phone, and its pipe reaches the phone's key session - a report there and back over Bluetooth
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { identity, dev, bid, fakeKey } = require('./helpers');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createKeySession } = require('node-onlykey-lib/desktop/session');
const { createDesktopPipe } = require('node-onlykey-lib/cli/transport-desktop');
const { phoneChannel } = require('node-onlykey-lib/cli/ble-room');
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
  /* a payload as the phone's side sends it (a WHERE from an app whose JS started over: a new socket link, none open) */
  const fromPhone = (payload) => setImmediate(() => { for (const l of listeners.message) l({ command: bleSocket.CMD_SOCKET, bytes: Uint8Array.from(payload) }); });
  return { createLink, phone, fromPhone, drop() { up = false; for (const l of listeners.down) l('dropped'); phone.down('dropped'); } };
}

async function server(t, bt) {
  const Rectify = (await import('@bmatusiak/rectify')).default;
  const core = (await import('node-onlykey-lib/mcp/core')).default;
  const localhost = (await import('node-onlykey-lib/mcp/localhost')).default;
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
  /* this computer asks which room the phone is in (onlykey-js --ble): the Bluetooth device only, not the websocket one */
  const where = await (await fetch(`${s.url}/ble`)).json();
  assert.deepEqual(where, { host: 'box.ble', phones: [{ room: me.id, device: { ...where.phones[0].device, id: phone.you, name: 'Phone' } }] });
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

test('Bluetooth: the phone\'s app started over (WHERE, no socket open) - its dead socket closes, a WHERE with one open keeps it', async (t) => {
  const bt = fakeBluetooth();
  const { s } = await server(t, bt);
  const host = await hereFrom(bt.phone);
  const seed = 'ble-where';
  const me = await identity(seed);
  const key = keyOf(seed);
  const login = (asked) => bid.signLogin(key, me.identityPublicKey, me.bucketKey.publicKey, asked);
  const phone = await connectRoom({ url: `ble://${host}`, me, device: dev('Phone', 'android'), WebSocket: bt.phone.WebSocket, randomBytes, login, timeoutMs: 5000 });
  const desk = await connectRoom({ url: s.url, me, device: dev('Desktop', 'desktop'), WebSocket: globalThis.WebSocket, randomBytes, timeoutMs: 5000 });
  /* the target set again while joined: the phone's socket is open, nothing closes */
  bt.phone.where();
  await new Promise((r) => setTimeout(r, 50));
  assert.deepEqual(desk.peers().map((p) => p.name), ['Phone']);
  /* the app's JS started over: a new socket link with nothing open asks WHERE */
  const left = new Promise((resolve) => desk.on('peer', (e) => { if (e.down === phone.you) resolve(); }));
  bt.fromPhone(bleSocket.encodeWhere({ open: false }));
  await left;
  assert.deepEqual((await (await fetch(`${s.url}/ble`)).json()).phones, []);
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

test('onlykey-js --ble: the computer finds the phone\'s room, the owner accepts it, its pipe reaches the phone\'s key', async (t) => {
  const bt = fakeBluetooth();
  const { s } = await server(t, bt);
  const host = await hereFrom(bt.phone);
  const seed = 'ble-cli';
  const me = await identity(seed);
  const key = keyOf(seed);
  const login = (asked) => bid.signLogin(key, me.identityPublicKey, me.bucketKey.publicKey, asked);
  const phone = await connectRoom({ url: `ble://${host}`, me, device: dev('Phone', 'android'), WebSocket: bt.phone.WebSocket, randomBytes, login, timeoutMs: 5000 });
  /* the phone: its key session for the room's agents (as the app's keyAgents.ts), and the owner accepting what is new */
  const session = createKeySession({ pipe: fakeKey(), hostFor: () => ({ send: async () => null }), dev: 'android', holder: 'the phone' });
  const clients = new Map();
  phone.on('key', ({ from, m }) => {
    let c = clients.get(from);
    if (!c) { c = { send: (obj) => phone.keyReply(from, obj) }; clients.set(from, c); }
    if (m.t === 'hello') void session.open(c);
    else void session.message(c, m);
  });
  phone.on('key-gone', ({ from }) => { const c = clients.get(from); if (c) { session.close(c); clients.delete(from); } });
  phone.on('mcp', (e) => { if (e.ev === 'agent' && e.agent.state === 'pending') void phone.mcp('agent', { agent: e.agent.id, state: 'accepted' }); });
  /* the CLI */
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ble-cli-'));
  const said = [];
  const pipe = createDesktopPipe({ channel: phoneChannel({ url: s.url, root, name: 'box CLI', say: (l) => said.push(l), acceptMs: 5000 }) });
  await pipe.start();
  assert.ok(said.some((l) => /accept "box CLI" on the phone/.test(l)), said.join(' | '));
  assert.deepEqual(pipe.device, { product: 'fake key' });
  const got = new Promise((resolve) => pipe.on('stream', (e) => { if (e.dir === 0) resolve(e.bytes); }));
  const report = new Uint8Array(64);
  report[0] = 7;
  await pipe.write(2, report);
  assert.equal((await got)[0], 8, 'the phone\'s key answered over Bluetooth');
  await pipe.stop();
  /* accepted once: the next run goes straight through, nothing to accept */
  said.length = 0;
  const again = createDesktopPipe({ channel: phoneChannel({ url: s.url, root, name: 'box CLI', say: (l) => said.push(l), acceptMs: 5000 }) });
  await again.start();
  assert.deepEqual(said, []);
  await again.stop();
  phone.close();
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

/*
 * The server's rooms, against a running server (ok-edge plan M1): `npm run server:dev`, then
 *   OKS_URL=http://127.0.0.1:8787 node --test mcp-server/test/rooms.test.js
 * Devices here are made from seeds, as the lib's room and trade tests make them: a bucket identity, its bucket key and
 * the certificate a key would make - no key needed. What a key adds (the press, the real certificate) is proven in
 * the apps (M2).
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const path = require('path');

/* the lib's own vendored curves (absolute paths: its package exports name only its entry points) */
const lib = path.dirname(require.resolve('node-onlykey-lib/package.json'));
const { sha256 } = require(path.join(lib, 'src/vendor/exports/@noble/hashes/sha2.js'));
const { ed25519, x25519 } = require(path.join(lib, 'src/vendor/exports/@noble/curves/ed25519.js'));
const { bucketIdentity: bid, room } = require('node-onlykey-lib/bucket');

const BASE = process.env.OKS_URL || 'http://127.0.0.1:8787';
const HOST = new URL(BASE).host;
const WS = BASE.replace(/^http/, 'ws');

async function identity(seed) {
  const secretOf = (label, keyType) => sha256(new Uint8Array([...new TextEncoder().encode(seed), ...label, keyType]));
  const key = { agent: {
    publicKey: async (label, { keyType }) => (keyType === 1 ? ed25519.getPublicKey(secretOf(label, 1)) : x25519.getPublicKey(secretOf(label, 4))),
    ecdh: async (label, peer) => x25519.getSharedSecret(secretOf(label, 4), peer),
    sign: async (label, message) => ed25519.sign(message, secretOf(label, 1)),
  } };
  const { publicKey, id } = await bid.readIdentity(key);
  const bucketKey = await bid.deriveBucketKey(key, publicKey);
  const certificate = await bid.certify(key, publicKey, bucketKey.publicKey);
  return { id, identityPublicKey: publicKey, bucketKey, certificate };
}

const dev = (name, kind) => ({ id: crypto.randomBytes(8).toString('hex'), name, kind });

/* a connection with its messages queued, so a test reads them in order: next() waits for the next one */
function connect(roomId) {
  const ws = new WebSocket(`${WS}/ws/${roomId}`);
  const queue = [];
  const waiting = [];
  let closed = null;
  const put = (m) => (waiting.length ? waiting.shift()(m) : queue.push(m));
  ws.onmessage = (ev) => put(JSON.parse(ev.data));
  ws.onclose = (ev) => { closed = { code: ev.code }; put({ t: '(closed)', code: ev.code }); };
  return {
    ws,
    send: (m) => ws.send(JSON.stringify(m)),
    next: (ms = 5000) => (queue.length ? Promise.resolve(queue.shift()) : new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`no message in ${ms} ms`)), ms);
      waiting.push((m) => { clearTimeout(timer); resolve(m); });
    })),
    get closed() { return closed; },
    close: () => ws.close(),
  };
}

/* connect and join: the challenge, the join over this server's host, the answer */
async function enter(me, device, { host = HOST, roomId = me.id } = {}) {
  const c = connect(roomId);
  const ch = await c.next();
  assert.equal(ch.t, 'challenge');
  c.send(room.join(me, { nonce: ch.nonce, host }, device));
  return { c, answer: await c.next() };
}

test('the web app is served on every route but /ws/', async () => {
  for (const p of ['/', '/passwords/anything']) {
    const r = await fetch(BASE + p);
    assert.equal(r.status, 200);
    assert.match(await r.text(), /<title>ok-edge<\/title>/);
  }
  const plain = await fetch(`${BASE}/ws/${'0'.repeat(32)}`);
  assert.equal(plain.status, 426);
});

test('two devices of one identity meet in its room and pass frames both ways', async () => {
  const me = await identity(`backup ${Date.now()}`);
  const phone = dev('Pixel', 'android');
  const web = dev('Chromium', 'webapp');
  const a = await enter(me, phone);
  assert.deepEqual(a.answer, { t: 'joined', you: phone.id, peers: [] });
  const b = await enter(me, web);
  assert.deepEqual(b.answer, { t: 'joined', you: web.id, peers: [phone] });
  assert.deepEqual(await a.c.next(), { t: 'peer', up: web });

  b.c.send({ t: 'frame', to: phone.id, body: 'hello from the web app' });
  assert.deepEqual(await a.c.next(), { t: 'frame', from: web.id, body: 'hello from the web app' });
  a.c.send({ t: 'frame', to: web.id, body: 'x'.repeat(300_000) });
  const big = await b.c.next();
  assert.equal(big.from, phone.id);
  assert.equal(big.body.length, 300_000);

  a.c.send({ t: 'frame', to: 'ffffffffffffffff', body: 'nobody' });
  assert.deepEqual(await a.c.next(), { t: 'gone', to: 'ffffffffffffffff' });
  a.c.send({ t: 'ping' });
  assert.deepEqual(await a.c.next(), { t: 'pong' });

  b.c.close();
  assert.deepEqual(await a.c.next(), { t: 'peer', down: web.id });
  a.c.close();
});

test('a reconnecting device replaces its old socket; the others hear nothing', async () => {
  const me = await identity(`backup r ${Date.now()}`);
  const phone = dev('Pixel', 'android');
  const desk = dev('Windows', 'desktop');
  const a = await enter(me, phone);
  const d = await enter(me, desk);
  await a.c.next(); /* peer up: desk */
  const a2 = await enter(me, phone);
  assert.deepEqual(a2.answer, { t: 'joined', you: phone.id, peers: [desk] });
  assert.deepEqual(await a.c.next(), { t: '(closed)', code: 4409 });
  d.c.send({ t: 'frame', to: phone.id, body: 'to the new socket' });
  assert.deepEqual(await a2.c.next(), { t: 'frame', from: desk.id, body: 'to the new socket' });
  d.c.send({ t: 'peers' });
  assert.deepEqual(await d.c.next(), { t: 'peers', peers: [phone] });
  a2.c.close();
  d.c.close();
});

test('no proof, no room: another identity, another server, a frame before joining - refused and closed', async () => {
  const me = await identity(`backup x ${Date.now()}`);
  const other = await identity(`backup y ${Date.now()}`);
  const phone = dev('Pixel', 'android');

  const wrongRoom = await enter(other, phone, { roomId: me.id });
  assert.deepEqual(wrongRoom.answer, { t: 'refused' });
  assert.deepEqual(await wrongRoom.c.next(), { t: '(closed)', code: 4401 });

  const wrongHost = await enter(me, phone, { host: 'evil.example' });
  assert.deepEqual(wrongHost.answer, { t: 'refused' });

  const early = connect(me.id);
  await early.next(); /* challenge */
  early.send({ t: 'frame', to: phone.id, body: 'let me in' });
  assert.deepEqual(await early.next(), { t: 'refused' });
  assert.deepEqual(await early.next(), { t: '(closed)', code: 4401 });

  /* and the room shows a refused device to nobody */
  const a = await enter(me, phone);
  assert.deepEqual(a.answer, { t: 'joined', you: phone.id, peers: [] });
  a.c.close();
});

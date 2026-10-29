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

const { BASE, identity, dev, connect, enter } = require('./helpers');

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

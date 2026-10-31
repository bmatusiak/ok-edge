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

test('the sealed copy: a device puts its rows, a fresh device of the identity catches up from them; the server keeps none for an identity it is not set to', async () => {
  const path = require('path');
  const lib = path.dirname(require.resolve('node-onlykey-lib/package.json'));
  const bucketLib = require('node-onlykey-lib/bucket');
  const { connectRoom } = require(path.join(lib, 'bucket/src/room-client.js'));
  const me = await identity(`sealed ${Date.now()}`);
  const randomBytes = (n) => new Uint8Array(require('crypto').randomBytes(n));
  const open = (device) => connectRoom({ url: BASE, me, device, WebSocket, randomBytes });
  const keys = bucketLib.sealedCopy.keysOf(me.bucketKey);
  const phone = await open(dev('Pixel', 'android'));
  const store = phone.sealedStore();
  /* every identity syncs: the copy is on whatever the tier (free: dropped after 7 days untouched; lifetime: kept) */
  assert.equal(await store.on(), true);
  const tier = store.tier();
  assert.ok(tier && ['free', 'lifetime'].includes(tier.tier), `the table says its tier: ${JSON.stringify(tier)}`);
  if (tier.tier === 'free') assert.ok(tier.purgeAt > Date.now(), 'a free copy says when it is dropped');
  else assert.equal(tier.purgeAt, null);
  const b = bucketLib.create({ owner: me.id });
  bucketLib.kv(b, 'guestbook').setItem('myname', 'Pixel Tester');
  const up = await bucketLib.sealedCopy.syncWith(b, keys, store, { randomBytes, heads: { aaaaaaaaaaaaaaaa: 7 } });
  assert.equal(up.put, 2, 'one unit and the heads row');
  phone.close();
  /* a fresh web app of the same identity: empty, then the same bucket - and nothing more on a second sync */
  const web = await open(dev('Chromium', 'webapp'));
  const fresh = bucketLib.create({ owner: me.id });
  const down = await bucketLib.sealedCopy.syncWith(fresh, keys, web.sealedStore(), { randomBytes });
  assert.equal(down.got, 1);
  assert.equal(bucketLib.kv(fresh, 'guestbook').getItem('myname'), 'Pixel Tester');
  assert.deepEqual(bucketLib.sealedCopy.openHeads((await web.sealedStore().get([bucketLib.sealedCopy.headsId(keys)]))[bucketLib.sealedCopy.headsId(keys)], keys), { aaaaaaaaaaaaaaaa: 7 });
  const again = await bucketLib.sealedCopy.syncWith(fresh, keys, web.sealedStore(), { randomBytes, heads: { aaaaaaaaaaaaaaaa: 7 } });
  assert.deepEqual([again.got, again.put], [0, 0]);
  /* a put is news to the identity's other devices: the room tells them its ids and tags, and they name the store it touches */
  const phone2 = await open(dev('Pixel', 'android'));
  const heard = new Promise((res) => web.on('sealed-changed', res));
  bucketLib.kv(b, 'guestbook').setItem('myname', 'Pixel 6a');
  await bucketLib.sealedCopy.syncWith(b, keys, phone2.sealedStore(), { randomBytes });
  const news = await heard;
  assert.deepEqual(bucketLib.sealedCopy.locate(fresh, keys, news.rows), { stores: ['guestbook'], unknown: 0 });
  phone2.close();
  /* what the server holds names nothing */
  const table = JSON.stringify(await web.sealedStore().table());
  assert.ok(!/guestbook|myname/.test(table));
  web.close();
});

test('the free tier: a copy nothing touches for its window is dropped; a touch starts the window again (a test server with SEALED_FREE_MS short)', async (t) => {
  const path = require('path');
  const lib = path.dirname(require.resolve('node-onlykey-lib/package.json'));
  const bucketLib = require('node-onlykey-lib/bucket');
  const { connectRoom } = require(path.join(lib, 'bucket/src/room-client.js'));
  const me = await identity(`free ${Date.now()}`);
  const randomBytes = (n) => new Uint8Array(require('crypto').randomBytes(n));
  const open = (device) => connectRoom({ url: BASE, me, device, WebSocket, randomBytes });
  const keys = bucketLib.sealedCopy.keysOf(me.bucketKey);
  const phone = await open(dev('Pixel', 'android'));
  const store = phone.sealedStore();
  await store.on();
  const tier = store.tier();
  /* a lifetime server (local dev's *), or a free window too long to wait out here: said, not run */
  if (!tier || tier.tier !== 'free' || tier.purgeAt - Date.now() > 20000) {
    phone.close();
    t.skip(`this server's free window is not a test one (${JSON.stringify(tier)}) - run one with --var SEALED_FREE_MS:4000`);
    return;
  }
  const b = bucketLib.create({ owner: me.id });
  bucketLib.kv(b, 'guestbook').setItem('myname', 'Pixel Tester');
  await bucketLib.sealedCopy.syncWith(b, keys, store, { randomBytes });
  const windowMs = tier.purgeAt - Date.now();
  /* half the window later a touch (a table) starts it again: still there after the first deadline */
  await new Promise((r) => setTimeout(r, windowMs / 2));
  await store.table();
  await new Promise((r) => setTimeout(r, windowMs / 2 + 500));
  assert.equal(Object.keys(await store.table()).length, 1, 'a touched copy was dropped');
  phone.close();
  /* then nothing touches it for a whole window: dropped */
  await new Promise((r) => setTimeout(r, windowMs + 2000));
  const again = await open(dev('Pixel', 'android'));
  assert.deepEqual(await again.sealedStore().table(), {}, 'an untouched free copy was kept');
  again.close();
});

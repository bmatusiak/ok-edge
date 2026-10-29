/*
 * What the server tests share (rooms.test.js, mcp.test.js): the server's address (OKS_URL), devices made from seeds -
 * a bucket identity, its bucket key and the certificate a key would make, no key needed - and a room connection whose
 * messages queue so a test reads them in order.
 */
'use strict';

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
  /* derive_secret under a site, as the key derives it: one secret per (seed, label, site) */
  const key = { deriveSecret: async (label, { rpId } = {}) => sha256(new TextEncoder().encode(seed + '|' + label + '|' + rpId)), agent: {
    publicKey: async (label, { keyType }) => (keyType === 1 ? ed25519.getPublicKey(secretOf(label, 1)) : x25519.getPublicKey(secretOf(label, 4))),
    ecdh: async (label, peer) => x25519.getSharedSecret(secretOf(label, 4), peer),
    sign: async (label, message) => ed25519.sign(message, secretOf(label, 1)),
  } };
  const { publicKey, id } = await bid.readIdentity(key);
  const bucketKey = await bid.deriveBucketKeyAt(key, publicKey, 'okt.example');
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

module.exports = { BASE, HOST, WS, identity, dev, connect, enter, room, bid };

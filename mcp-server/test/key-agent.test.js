/*
 * A COMPUTER ON A DEVICE'S KEY THROUGH THE ROOM (ok-edge plan B4): the localhost service in this process; a device of
 * the identity joins (the open join: this computer's own 127.0.0.1) and runs the lib's key session
 * (desktop/session.js) on a fake key, answering over the room; a CLI-side agent (bucket roomAgent.connectAgent) reaches
 * it with cli/transport-desktop.js over the agent's key channel - the same pipe the desktop's CLI uses.
 *
 *   - a new agent is pending: the owner's device hears it; its key messages are refused
 *   - accepted by the owner (mcp-re op 'agent'): the pipe opens, a report goes to the key and its answer comes back
 *   - blocked: its socket closes at once, and the device hears its session is over
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { identity, dev, fakeKey } = require('./helpers');
const { roomClient, roomAgent } = require('node-onlykey-lib/bucket');
const { createKeySession } = require('node-onlykey-lib/desktop/session');
const { createDesktopPipe } = require('node-onlykey-lib/cli/transport-desktop');

const randomBytes = (n) => new Uint8Array(crypto.randomBytes(n));
const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));

async function server(t) {
  const Rectify = (await import('@bmatusiak/rectify')).default;
  const core = (await import('node-onlykey-lib/mcp/core')).default;
  const localhost = (await import('node-onlykey-lib/mcp/localhost')).default;
  const app = Rectify.build([core, localhost]);
  await app.start();
  const s = await app.services.mcpLocalhost.start({ port: 0, env: { REQUIRE_LOGIN: '0', OPEN_JOIN: '1' } });
  t.after(() => s.close());
  return s;
}

test('an agent on a device\'s key: pending and refused, accepted and answered, blocked and closed', async (t) => {
  const s = await server(t);
  const me = await identity('key-agent');
  /* the device that holds the key: joined, its key session answering the room's key messages */
  const device = await roomClient.connectRoom({ url: s.url, me, device: dev('Phone', 'android'), WebSocket: globalThis.WebSocket, randomBytes, timeoutMs: 5000 });
  const heard = [];
  device.on('mcp', (e) => { if (e.ev === 'agent') heard.push(e.agent.state); });
  const session = createKeySession({ pipe: fakeKey(), hostFor: () => ({ send: async () => null }), dev: 'android', holder: 'the phone' });
  const clients = new Map();
  device.on('key', ({ from, m }) => {
    let c = clients.get(from);
    if (!c) { c = { send: (obj) => device.keyReply(from, obj) }; clients.set(from, c); }
    if (m.t === 'hello') void session.open(c);
    else void session.message(c, m);
  });
  const gone = [];
  device.on('key-gone', ({ from }) => { gone.push(from); const c = clients.get(from); if (c) { session.close(c); clients.delete(from); } });

  /* the CLI: an agent with its own key */
  const agentKey = crypto.randomBytes(32).toString('hex');
  const agent = await roomAgent.connectAgent({ url: s.url, room: me.id, agentKey, name: 'box CLI', WebSocket: globalThis.WebSocket });
  assert.equal(agent.state, 'pending');
  assert.deepEqual(agent.devices.map((d) => d.name), ['Phone']);
  await tick();
  assert.deepEqual(heard, ['pending'], 'the owner heard a new agent');

  /* not accepted: the pipe is refused */
  const refusedPipe = createDesktopPipe({ channel: () => agent.keyChannel(device.you) });
  await assert.rejects(() => refusedPipe.start(), /refused: the owner has not accepted this computer/);

  /* the owner accepts it on the device */
  const again = await roomAgent.connectAgent({ url: s.url, room: me.id, agentKey, name: 'box CLI', WebSocket: globalThis.WebSocket });
  await device.mcp('agent', { agent: again.you, state: 'accepted' });
  const pipe = createDesktopPipe({ channel: () => again.keyChannel(device.you) });
  await pipe.start();
  assert.equal(pipe.isRunning(), true);
  assert.deepEqual(pipe.device, { product: 'fake key' });
  const got = new Promise((resolve) => pipe.on('stream', (e) => { if (e.dir === 0) resolve(e.bytes); }));
  const report = new Uint8Array(64);
  report[0] = 41;
  await pipe.write(2, report);
  assert.equal((await got)[0], 42, 'the key answered through the room');

  /* blocked: the agent's socket closes and the device ends its session */
  const closed = new Promise((resolve) => again.on('close', resolve));
  await device.mcp('agent', { agent: again.you, state: 'blocked' });
  await closed;
  await tick();
  assert.ok(gone.includes(again.you), 'the device heard the session is over');
  assert.equal(session.connected, false);
  /* and a blocked agent cannot come back */
  await assert.rejects(() => roomAgent.connectAgent({ url: s.url, room: me.id, agentKey, name: 'box CLI', WebSocket: globalThis.WebSocket }), /blocked/);
  device.close();
});

#!/usr/bin/env node
'use strict';
/*
 * ok-edge B4: read a hard key's Edge state over USB - read only, no press, no link: the head, the budgets
 * still live, what is owed, the device id, and the newest links with who paid them (decision, grant).
 * Run with NODE_PATH pointing at a node_modules that has node-hid (the kit's), as the CLI on the box.
 *
 *   node edge-read.js <node-onlykey-lib folder> [how many newest links, default 6]
 */
const [LIB, nArg] = process.argv.slice(2);
const N = Number(nArg) || 6;
(async () => {
  const app = await require(`${LIB}/cli/desktop`).startDesktop({});
  try {
    const hello = await app.services.device.connect();
    console.log('device:', String(hello && (hello.version || hello.status || hello)).trim().slice(0, 60));
    let edge = null;
    require(`${LIB}/edge/plugin`)({ transport: app.services.transport }, (err, s) => { if (err) throw err; edge = s.edge; });
    const { chain, codes } = require(`${LIB}/edge/src`);
    const hex = (b) => (b ? Buffer.from(b).toString('hex') : '');
    const h = await edge.head({ timeoutMs: 8000 });
    const { deviceId } = await edge.publicKey({ timeoutMs: 8000 });
    console.log(`head: seq ${h.seq}, owed ${h.owed}, live budgets [${(h.live || []).join(', ')}], device ${hex(deviceId).slice(0, 16)}`);
    const name = (table, v) => (Object.entries(table).find(([, x]) => x === v) || [String(v)])[0];
    const from = Math.max(h.oldest === null ? 0 : h.oldest, (h.seq || 0) - N + 1);
    for (let s = from; h.seq !== null && s <= h.seq; s++) {
      const [l] = await edge.pickup(s, 1).catch(() => [null]);
      if (!l) { console.log(`  #${s}: (not held)`); continue; }
      const f = chain.decodeLink(l.link);
      console.log(`  #${f.seq}: op ${name(codes.OP, f.op)}, decision ${name(codes.DECISION, f.decision)}, grant ${f.grantId}, step ${f.grantStep}, flags 0x${f.flags.toString(16)}`);
    }
  } catch (e) {
    console.log('ERROR', e && e.message);
  } finally {
    await Promise.resolve(app.destroy && app.destroy()).catch(() => {});
    setTimeout(() => process.exit(0), 300);
  }
})();

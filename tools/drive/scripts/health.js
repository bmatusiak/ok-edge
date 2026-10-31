'use strict';
/*
 * AN APP'S HEALTH (drive debugging #7): how big and how busy its processes are (from the machine it runs on), and what
 * it keeps (from the app: each key and its size on the testnet, only how many and how much on the live chain - never a
 * value).   run.js health [--app <shell>]
 */
module.exports = async (d) => {
  const m = await d.machine('health');
  d.say(`its processes (${m.where}):`);
  for (const l of String(m.ok ? m.what : m.why).split('\n')) d.say(`  ${l}`);
  if (d.app.closed || !d.app.ws) { d.say('its storage: the app is not connected'); return; }
  const r = await d.app.call({ t: 'health' }, 30000);
  if (!r.ok) throw new Error(`its storage: ${r.why}`);
  const kb = (n) => `${Math.round(n / 1024)} KB`;
  if (!r.keys) { d.say(`its storage (live chain - names stay on the device): ${r.count} key(s), ${kb(r.total)}${r.databases ? `, ${r.databases} database(s)` : ''}`); return; }
  d.say(`its storage: ${r.keys.length} key(s), ${kb(r.total)}${r.databases.length ? `; databases: ${r.databases.join(', ')}` : ''} - the biggest:`);
  for (const k of [...r.keys].sort((a, b) => b.bytes - a.bytes).slice(0, 12)) d.say(`  ${kb(k.bytes).padStart(8)}  ${k.key}`);
};

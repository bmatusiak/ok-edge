#!/usr/bin/env node
// What one web app run cost at the key, from its page log (webapp-edge-budget.sh CONSOLE=<file>): every Edge request
// over the tunnel ([edge-trace] > / < pairs: a temporary trace in the box's installed lib copy) and the tab's own
// timings ([edge] sync / run / testing sign). tunnel-speed.sh prints it for each build, before and after a patch.
//   node tools/box/trace-times.js /tmp/pc.log
const fs = require('fs');
const lines = fs.readFileSync(process.argv[2], 'latin1').split('\n');
/* the trace's clock is ms modulo 100 000 (it only has to order a request's two ends) */
const span = (a, b) => (b - a + 100000) % 100000;
const open = new Map();
const done = [];
for (const l of lines) {
  let m = /\[edge-trace\] (\w+) > sub (\d+) #(\d+) (\d+)/.exec(l);
  if (m) { open.set(m[3], { sub: Number(m[2]), at: Number(m[4]) }); continue; }
  m = /\[edge-trace\] (\w+) < sub (\d+) #(\d+) .* (\d+)\s*$/.exec(l);
  if (m && open.has(m[3])) { const o = open.get(m[3]); done.push({ what: `sub ${o.sub}`, ms: span(o.at, Number(m[4])) }); open.delete(m[3]); continue; }
  m = /\[edge-trace\] (\w+) > MORE (\d+)/.exec(l);
  if (m) { open.set('more', { sub: 'MORE', at: Number(m[2]) }); continue; }
  m = /\[edge-trace\] (\w+) < MORE .* (\d+)\s*$/.exec(l);
  if (m && open.has('more')) { done.push({ what: 'MORE', ms: span(open.get('more').at, Number(m[2])) }); open.delete('more'); }
}
const names = { 'sub 1': 'HEAD', 'sub 2': 'PICKUP', 'sub 3': 'CHECKPOINT', 'sub 4': 'PUBKEY', 'sub 5': 'PUBKEY_PQ', 'sub 16': 'GRANT_CREATE', 'sub 17': 'GRANT_LABEL', MORE: 'MORE (ML-DSA half)' };
const by = new Map();
for (const d of done) {
  const k = names[d.what] || d.what;
  const e = by.get(k) || { n: 0, ms: 0, max: 0 };
  e.n += 1; e.ms += d.ms; e.max = Math.max(e.max, d.ms);
  by.set(k, e);
}
const total = done.reduce((s, d) => s + d.ms, 0);
console.log(`Edge requests over the tunnel: ${done.length}, ${(total / 1000).toFixed(1)} s in all, ${done.length ? (total / done.length / 1000).toFixed(2) : '-'} s each on average`);
/* a GRANT_CREATE waits for the person's press: its time is the press, not the tunnel */
for (const [k, e] of [...by].sort((a, b) => b[1].ms - a[1].ms)) {
  console.log(`  ${k.padEnd(20)} ${String(e.n).padStart(3)} x  avg ${(e.ms / e.n / 1000).toFixed(2)} s  max ${(e.max / 1000).toFixed(2)} s`);
}
for (const l of lines) {
  const m = /\[edge\] (sync \d+ ms: .*|run \d+ ms: .*|testing sign .*)$/.exec(l);
  if (m) console.log(`  tab: ${m[1].slice(0, 170)}`);
}

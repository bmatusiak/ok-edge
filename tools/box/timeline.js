#!/usr/bin/env node
// THE LOGIN'S TIMELINE (Brad, 2026-10-28: "measure the entire process from start of the webapp login to the end of
// bucket, see why in-between actions have a huge gap"): the box flow's steps (webapp-edge-budget.sh, its "== HH:MM:SS.mmm"
// lines) and the page's own [timeline] lines (src/keyBusy.ts: each key operation's begin and end, each wait the lib
// takes before one) on one clock, then where the time went: inside key operations, in the lib's waits, and the rest -
// the page's own work and the browser between them - with the largest gaps and what was on either side.
//   node tools/box/timeline.js <flow log> <page log>
const fs = require('fs');
const [flowFile, pageFile] = process.argv.slice(2);
const page = fs.readFileSync(pageFile, 'latin1').split('\n');
const ev = [];
for (const l of page) {
  const m = /\[timeline\] (\d{13}) (.*)$/.exec(l);
  if (m) ev.push({ t: Number(m[1]), src: 'page', text: m[2].trim() });
}
if (!ev.length) { console.log('no [timeline] lines in the page log (a debug build of the web app logs them)'); process.exit(1); }
/* the flow's clock is the box's local time of day; the page's is epoch ms on the same box */
const day = new Date(ev[0].t);
for (const l of fs.readFileSync(flowFile, 'latin1').split('\n')) {
  const m = /^== (\d\d):(\d\d):(\d\d)\.(\d{3}) (.*)$/.exec(l);
  if (!m) continue;
  const d = new Date(day); d.setHours(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]));
  ev.push({ t: d.getTime(), src: 'flow', text: m[5].trim() });
}
ev.sort((a, b) => a.t - b.t);
const start = (ev.find((e) => e.src === 'flow' && /^reload/.test(e.text)) || ev[0]).t;
const endFlow = [...ev].reverse().find((e) => e.src === 'flow' && /bucket is open/.test(e.text));
const end = endFlow ? endFlow.t : ev[ev.length - 1].t;
const s = (ms) => (ms / 1000).toFixed(2).padStart(7);
const open = new Map();
let inOps = 0;
let waited = 0;
let lastEnd = null;
let lastWhat = null;
const gaps = [];
console.log('   time    took   what');
for (const e of ev) {
  if (e.t < start || e.t > end) continue;
  let took = '';
  let m = /^begin #(\d+) (.*)$/.exec(e.text);
  if (m) {
    open.set(m[1], e.t);
    if (lastEnd !== null) gaps.push({ ms: e.t - lastEnd, after: lastWhat, before: m[2], at: e.t });
  }
  m = /^end #(\d+) (.*?) steps=(\d+)/.exec(e.text);
  if (m && open.has(m[1])) { const d = e.t - open.get(m[1]); inOps += d; took = s(d); open.delete(m[1]); lastEnd = e.t; lastWhat = m[2]; }
  m = /^wait (\d+) ms/.exec(e.text);
  if (m) { waited += Number(m[1]); took = s(Number(m[1])); }
  console.log(`${s(e.t - start)} ${took.padStart(7)}   ${e.src === 'flow' ? '>> ' : '   '}${e.text.slice(0, 110)}`);
}
const total = end - start;
console.log(`\nfrom the reload to the bucket open: ${s(total)} s`);
console.log(`  inside key operations   ${s(inOps)} s  (each request's own ceremonies, the lib's waits before it included)`);
console.log(`  of which the lib waited ${s(waited)} s  (the key's last reply to expire, its timers)`);
console.log(`  outside key operations  ${s(total - inOps)} s  (the page's own work, the browser, the flow's steps and presses)`);
console.log('\nthe largest gaps between one key operation and the next:');
for (const g of gaps.sort((a, b) => b.ms - a.ms).slice(0, 8)) {
  console.log(`  ${s(g.ms)} s at ${s(g.at - start)}  after "${g.after}"  before "${g.before}"`);
}

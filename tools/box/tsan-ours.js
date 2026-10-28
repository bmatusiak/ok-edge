#!/usr/bin/env node
'use strict';
/*
 * TSAN REPORTS THAT ARE OURS (tsan-restore.sh's logs): node is not built with TSan, so V8's JIT and garbage collector
 * fill the log with races TSan cannot see the locks of. A report counts here only when one of its stacks passes
 * through the emulator addon (onlykey_emulator.node) - the firmware, the HAL, the plugins. Grouped by the first frame
 * of our code on each side, so one race found a hundred times is one line.
 *
 *   node tsan-ours.js <onlykey_emulator.node> /tmp/tsan-restore.*
 *
 * TSan leaves the addon's frames unsymbolized ("<null> <null> (onlykey_emulator.node+0x9e7fd)") when it runs inside
 * an uninstrumented node, so each offset is resolved here with addr2line against the .node (built with -g).
 */
const fs = require('fs');
const { execFileSync } = require('child_process');

const [addon, ...files] = process.argv.slice(2);
const OFF = /onlykey_emulator\.node\+(0x[0-9a-f]+)/;
const ours = (line) => OFF.test(line);

/* every offset once, one addr2line call: offset -> "function file.cpp:line" */
const offsets = new Set();
for (const file of files) for (const m of fs.readFileSync(file, 'utf8').matchAll(new RegExp(OFF, 'g'))) offsets.add(m[1]);
const names = new Map();
if (offsets.size) {
  const list = [...offsets];
  const out = execFileSync('addr2line', ['-f', '-C', '-e', addon, ...list], { encoding: 'utf8', maxBuffer: 64 << 20 }).split('\n');
  list.forEach((o, i) => {
    const fn = (out[2 * i] || '?').replace(/\(.*$/, '').replace(/^.*::/, (m) => m).slice(0, 60);
    const where = (out[2 * i + 1] || '?').replace(/^.*\//, '').replace(/ \(discriminator \d+\)/, '');
    names.set(o, `${fn} ${where}`);
  });
}
const frameOf = (line) => names.get((OFF.exec(line) || [])[1]) || line.trim();

const groups = new Map();
let total = 0;
let mine = 0;
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const report of text.split(/^==================$/m)) {
    if (!/WARNING: ThreadSanitizer/.test(report)) continue;
    total++;
    const kind = (/WARNING: ThreadSanitizer: ([^(]+)/.exec(report) || [])[1]?.trim() || '?';
    /* each side: "Write of size 4 at ... by thread T3:" / "Previous read of size 4 ... by main thread:" then frames */
    const sides = [];
    for (const block of report.split(/\n(?=  (?:Write|Read|Atomic|Previous|Mutex|Location|Thread))/)) {
      const head = block.split('\n')[0].trim();
      if (!/^(Write|Read|Previous|Atomic)/.test(head)) continue;
      const frames = block.split('\n').filter((l) => /^\s+#\d+/.test(l));
      const first = frames.find(ours);
      sides.push({ head: head.replace(/ at 0x[0-9a-f]+/, '').replace(/\(.*?\)/g, '').trim(), first: first ? frameOf(first) : null });
    }
    if (!sides.some((s) => s.first)) continue;
    mine++;
    const key = `${kind} | ${sides.map((s) => `${s.head.split(' by ')[0]} @ ${s.first || '(not ours)'} by ${s.head.split(' by ')[1] || '?'}`).join('  <->  ')}`;
    groups.set(key, (groups.get(key) || 0) + 1);
  }
}
console.log(`${total} reports, ${mine} through the emulator addon, ${groups.size} distinct:`);
for (const [k, n] of [...groups].sort((a, b) => b[1] - a[1])) console.log(`${String(n).padStart(5)}  ${k}`);

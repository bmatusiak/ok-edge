#!/usr/bin/env node
'use strict';
/*
 * hardkey-press.js - the buttons of a HARD key on the box's USB, pressed through its DEBUG console (Linux, a test hex
 * only: a production build has no console, so only a person's fingers press it).
 *
 *   node tools/box/hardkey-press.js 1 2 3 4 5 6 1      a PIN: seven taps, in one console line
 *   node tools/box/hardkey-press.js 1:hold             button 1 held (tap | hold | long | longest)
 *   node tools/box/hardkey-press.js --after='RE' 1     press once the key's console prints a line matching RE
 *   node tools/box/hardkey-press.js --watch            no presses: print the key's console lines
 *   node tools/box/hardkey-press.js --list             the OnlyKey hidraw nodes, which is the hard key's console
 *
 * Why the console and not anything else: the web app flows on the box (webapp-edge-budget.sh) press the soft key
 * through the emulator's socket (press.js); a hard key has no socket, but its DEBUG build reads presses from its SEREMU
 * interface (HID usage page 0xFFC9) - the same line protocol the testing kit uses (onlykey-testing lib/device
 * pressLine: digits, '!' modifiers for holds, one line, the firmware paces the replay). One OUT report is 32 bytes.
 *
 * Which node: the box has the gadget soft key on the bus too (dummy_hcd, the same 1d50:60fc - it shows as a real
 * OnlyKey); its nodes are skipped, so only a key on a real USB port is ever pressed.
 */
const fs = require('fs');
const path = require('path');

const HOLD = { tap: '', hold: '!', long: '!!', longest: '!!!' };
const LINE_MAX = 32; /* the firmware's raw line buffer: one SEREMU OUT report */
const QUEUE_MAX = 16; /* the firmware's press queue */

function nodes() {
  const dir = '/sys/class/hidraw';
  return fs.readdirSync(dir).map((n) => {
    const dev = path.join(dir, n, 'device');
    const uevent = fs.readFileSync(path.join(dev, 'uevent'), 'utf8');
    const desc = fs.readFileSync(path.join(dev, 'report_descriptor'));
    return {
      node: `/dev/${n}`,
      onlykey: /HID_ID=0003:00001D50:000060FC/i.test(uevent),
      /* the descriptor opens with Usage Page (06 lo hi): 0xFFC9 is SEREMU */
      seremu: desc[0] === 0x06 && desc[1] === 0xc9 && desc[2] === 0xff,
      gadget: fs.realpathSync(dev).includes('dummy'),
    };
  }).filter((x) => x.onlykey);
}

function hardConsole() {
  const found = nodes().filter((x) => x.seremu && !x.gadget);
  if (!found.length) throw new Error('no hard OnlyKey on the box\'s USB (only the gadget soft key, or nothing) - plug the key in');
  if (found.length > 1) throw new Error(`more than one hard OnlyKey on USB (${found.map((x) => x.node).join(', ')}) - leave one`);
  return found[0].node;
}

function line(presses) {
  if (presses.length > QUEUE_MAX) throw new Error(`at most ${QUEUE_MAX} presses a line (the firmware's queue), got ${presses.length}`);
  const text = presses.map((p) => {
    const [b, mode = 'tap'] = String(p).split(':');
    if (!/^[1-6]$/.test(b)) throw new Error(`a button is 1..6, got ${b}`);
    if (!(mode in HOLD)) throw new Error(`a press is ${Object.keys(HOLD).join(' | ')}, got ${mode}`);
    return `${b}${HOLD[mode]}`;
  }).join('');
  if (text.length + 1 > LINE_MAX) throw new Error(`the line is ${text.length + 1} bytes, the firmware takes ${LINE_MAX}`);
  return text;
}

/* one OUT report: hidraw's first byte is the report number (0: the console uses none), then the 32 bytes */
function send(node, text) {
  const report = Buffer.alloc(1 + LINE_MAX);
  Buffer.from(`${text}\n`, 'ascii').copy(report, 1);
  const fd = fs.openSync(node, 'r+');
  try { fs.writeSync(fd, report); } finally { fs.closeSync(fd); }
}

/* the console's lines as they come (64-byte IN reports, the text null-padded), until onLine returns true */
function readLines(node, onLine, timeoutMs) {
  return new Promise((resolve, reject) => {
    const s = fs.createReadStream(node, { highWaterMark: 64 });
    let buf = '';
    const done = (err, v) => { clearTimeout(t); s.destroy(); if (err) reject(err); else resolve(v); };
    const t = timeoutMs ? setTimeout(() => done(new Error(`no console line matched in ${timeoutMs / 1000} s`)), timeoutMs) : null;
    s.on('data', (d) => {
      buf += d.toString('latin1').replace(/\0+/g, '');
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const l = buf.slice(0, i).replace(/\r$/, '');
        buf = buf.slice(i + 1);
        if (onLine(l)) { done(null, l); return; }
      }
    });
    s.on('error', (e) => done(e));
  });
}

async function main(argv) {
  if (argv.includes('--list')) {
    for (const x of nodes()) console.log(`${x.node} ${x.seremu ? 'console' : '       '} ${x.gadget ? 'gadget soft key' : 'hard key'}`);
    return 0;
  }
  const node = hardConsole();
  if (argv.includes('--watch')) { await readLines(node, (l) => { console.log(l); return false; }, 0); return 0; }
  const after = (argv.find((a) => a.startsWith('--after=')) || '').slice(8);
  const timeout = Number((argv.find((a) => a.startsWith('--timeout=')) || '').slice(10)) || 60;
  const presses = argv.filter((a) => !a.startsWith('--'));
  if (!presses.length) { console.error('hardkey-press.js <button[:tap|hold|long|longest]>... [--after=RE] | --watch | --list'); return 2; }
  const text = line(presses);
  if (after) {
    const re = new RegExp(after);
    const seen = await readLines(node, (l) => re.test(l), timeout * 1000);
    console.log(`after: ${seen}`);
  }
  send(node, text);
  console.log(`pressed ${presses.join(' ')} on ${node}`);
  return 0;
}

main(process.argv.slice(2)).then((c) => { process.exitCode = c; }, (e) => { console.error(`hardkey-press: ${e.message}`); process.exitCode = 1; });

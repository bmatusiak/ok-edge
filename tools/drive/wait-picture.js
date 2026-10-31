#!/usr/bin/env node
'use strict';
/*
 * WAIT FOR BRAD'S NEXT PICTURE (Brad, 2026-10-31: "you should get events that i took a snapshot"): a picture asked from
 * any drive window (server.js shotNow - this machine's, or a remote's) writes its log sample here first, then the
 * pictures. This ends on the next such sample - not the drive's own error pictures - with its files, so whoever runs it
 * in the background is woken by its end. One picture, one end: run it again for the next.
 *   node tools/drive/wait-picture.js
 * Events only (fs.watch on the folder); the pictures are listed once the folder has been quiet for 3 s after the sample.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const SHOTS = process.env.DRIVE_SHOTS || path.join(os.homedir(), 'drive-logs', 'drive-shots');
fs.mkdirSync(SHOTS, { recursive: true });
const ASKED = /^(\d{6})-seen-by-(?!error)(.+)\.log$/;

let sample = null;
let quiet = null;
const done = () => {
  const stampOf = sample.match(ASKED)[1];
  const pictures = fs.readdirSync(SHOTS).filter((f) => f.endsWith('.png') && f.startsWith(stampOf)).sort();
  console.log(`PICTURE TAKEN: ${sample.replace(ASKED, '$2')} at ${stampOf.replace(/(\d\d)(\d\d)(\d\d)/, '$1:$2:$3')}`);
  console.log(`  log sample: ${path.join(SHOTS, sample)}`);
  for (const p of pictures) console.log(`  picture: ${path.join(SHOTS, p)}`);
  if (!pictures.length) console.log('  (no picture yet - an app may not have answered)');
  process.exit(0);
};
fs.watch(SHOTS, (event, name) => {
  if (!name) return;
  if (!sample && ASKED.test(name) && fs.existsSync(path.join(SHOTS, name))) sample = name;
  if (!sample) return;
  clearTimeout(quiet);
  quiet = setTimeout(done, 3000);
});
console.log(`waiting for the next picture asked from a drive window (${SHOTS})`);

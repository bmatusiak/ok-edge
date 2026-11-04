#!/usr/bin/env node
'use strict';
/*
 * THE APP'S ICON, EVERY SIZE, FROM ONE DRAWING (Brad, 2026-11-04: "electron-desktop and webapp are using stock icons,
 * webapp needs a favicon ... desktop needs icon for running app and bin for starting it"; the mark redrawn as a
 * vector). The phone already shows ok-rn's launcher icon - assets/O.png, the white O on black
 * (modules/okedge-native/app-res) - so the web app and the desktop get the same O, drawn here as shapes, not scaled
 * from that 257 x 205 PNG: sharp at 16 px and at 1024 px.
 *
 * The O as measured on assets/O.png (257 x 205): a frame 256 x 205, 34 thick, whose corners are superellipse quadrants
 * (86 across, 65 down, exponent 2.75 - not circles: a circle that reaches 86 across is far too round down the side),
 * and six keys, 36 x 36, at x 56 / 111 / 166 and y 56 / 113.
 *
 *   node tools/icons/make-icons.js      writes, white O on black:
 *     assets/icon.png        1024  the app icon (Expo's "icon"; the web export's touch icon)
 *     assets/favicon.png     48    the web app's favicon (the export turns it into favicon.ico)
 *     electron/icon.png      512   the desktop window's icon, and the Linux package's
 *     electron/icon.ico      16-256 the Windows .exe and its taskbar button
 * Run it again after changing the drawing; the files are committed (no build step makes them).
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const EDGE = path.resolve(__dirname, '..', '..');

/* ---------------------------------------------------------------- the O, in its own units (256 x 205) */
const O_W = 256;
const O_H = 205;
const RIM = 34;
const KEY = 36;
const KEYS_X = [56, 111, 166];
const KEYS_Y = [56, 113];
const CORNER = { a: 86, b: 65, n: 2.75 };

/* inside a rounded box whose corners are superellipse quadrants (a across, b down, exponent n) */
function inBox(x, y, x0, y0, x1, y1, a, b, n) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = x < x0 + a ? x0 + a : x > x1 - a ? x1 - a : x;
  const cy = y < y0 + b ? y0 + b : y > y1 - b ? y1 - b : y;
  if (cx === x || cy === y) return true;
  return Math.abs((x - cx) / a) ** n + Math.abs((y - cy) / b) ** n <= 1;
}

/* is this point of the O white? the frame (outer box less the inner one) or a key */
function ink(x, y) {
  const { a, b, n } = CORNER;
  if (inBox(x, y, 0, 0, O_W, O_H, a, b, n) && !inBox(x, y, RIM, RIM, O_W - RIM, O_H - RIM, a - RIM, b - RIM, n)) return true;
  return KEYS_X.some((kx) => x >= kx && x <= kx + KEY && KEYS_Y.some((ky) => y >= ky && y <= ky + KEY));
}

/* ---------------------------------------------------------------- a square tile, the O centred on black */
/* share: how much of the tile's width the O takes - more at the smallest sizes, where every pixel counts */
function tile(size) {
  const share = size <= 24 ? 0.9 : size <= 48 ? 0.82 : 0.7;
  const scale = (size * share) / O_W;
  const ox = (size - O_W * scale) / 2;
  const oy = (size - O_H * scale) / 2;
  const SS = 4; /* 4 x 4 samples a pixel */
  const rgba = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let hit = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          if (ink((px + (sx + 0.5) / SS - ox) / scale, (py + (sy + 0.5) / SS - oy) / scale)) hit++;
        }
      }
      const v = Math.round((255 * hit) / (SS * SS));
      const o = (py * size + px) * 4;
      rgba[o] = v; rgba[o + 1] = v; rgba[o + 2] = v; rgba[o + 3] = 255;
    }
  }
  return png(size, size, rgba);
}

/* ---------------------------------------------------------------- PNG and ICO, by hand */
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
const crc32 = (buf) => { let c = 0xffffffff; for (const x of buf) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'latin1');
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, tail]);
}
function png(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; /* 8-bit RGBA */
  const rows = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) rgba.copy(rows, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
/* an ICO of PNG images (Windows Vista and later read them; 256 is written as 0) */
function ico(images) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(1, 2); head.writeUInt16LE(images.length, 4);
  let at = 6 + 16 * images.length;
  const dir = images.map(({ size, data }) => {
    const e = Buffer.alloc(16);
    e[0] = size >= 256 ? 0 : size; e[1] = size >= 256 ? 0 : size;
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8); e.writeUInt32LE(at, 12);
    at += data.length;
    return e;
  });
  return Buffer.concat([head, ...dir, ...images.map((i) => i.data)]);
}

/* ---------------------------------------------------------------- the files */
const out = (rel, data) => { fs.writeFileSync(path.join(EDGE, rel), data); console.log(`${rel}  ${data.length} bytes`); };
out('assets/icon.png', tile(1024));
out('assets/favicon.png', tile(48));
out('electron/icon.png', tile(512));
out('electron/icon.ico', ico([16, 24, 32, 48, 64, 128, 256].map((size) => ({ size, data: tile(size) }))));

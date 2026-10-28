#!/usr/bin/env node
'use strict';
/*
 * A screenshot of the web app, after tapping through it - for checking a screen of a web export before it is
 * published, the way tools/tap.js checks the phone.
 *
 *   node tools/webshot.js --dir <web export> [--from <site>] [--tap Downloads]... [--out shot.png] [--width 420]
 *   node tools/webshot.js --dir <web export> [--from <site>] --serve [port]    only serve it, to open in a browser
 *
 * Serves the export on a local port (unknown paths get index.html, as the Worker's single-page-application handling
 * does), with --from copying /android/manifest.json and /firmware/manifest.json from a live site so the panels that
 * read them appear. Then headless Chrome (CHROME, else its usual Windows/Linux places) opens it over the DevTools
 * protocol - no puppeteer: Node's own WebSocket - clicks each --tap label in turn (the innermost element whose text is
 * exactly that label), and saves the whole page as a PNG.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
const taps = args.flatMap((a, i) => (a === '--tap' ? [args[i + 1]] : []));
const DIR = path.resolve(opt('--dir', 'docs'));
const FROM = opt('--from');
const OUT = path.resolve(opt('--out', 'webshot.png'));
const WIDTH = Number(opt('--width', 420));

const CHROME = process.env.CHROME || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find(p => fs.existsSync(p));

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function copyManifests() {
  if (!FROM) return;
  for (const p of ['android/manifest.json', 'firmware/manifest.json']) {
    const r = await fetch(new URL(p, FROM));
    if (!r.ok) { console.log(`--from: no ${p} (${r.status})`); continue; }
    fs.mkdirSync(path.dirname(path.join(DIR, p)), { recursive: true });
    fs.writeFileSync(path.join(DIR, p), Buffer.from(await r.arrayBuffer()));
  }
}

function serve(port = 0) {
  const server = http.createServer((req, res) => {
    let file = path.join(DIR, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIR, 'index.html');
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(port, '127.0.0.1', () => r(server)));
}

/* one DevTools session on the page's target: send(method, params) -> result */
async function devtools(port) {
  let targets;
  for (let i = 0; i < 50 && !targets; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch { await sleep(200); }
  }
  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0;
  const waiting = new Map();
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
  };
  const send = (method, params = {}) => new Promise((r, j) => {
    waiting.set(++id, m => (m.error ? j(new Error(`${method}: ${m.error.message}`)) : r(m.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });
  return { send, close: () => ws.close() };
}

const evaluate = async (send, expression) =>
  (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;

/* waits up to 10 s for a label, then clicks it; a missing label names the labels that ARE there */
async function tap(send, label) {
  const find = `(() => { const want = ${JSON.stringify(label)};
    const all = [...document.querySelectorAll('body *')].filter(e => e.textContent.trim() === want);
    const el = all.find(e => ![...e.children].some(c => c.textContent.trim() === want));
    if (el) { el.click(); return true; } return false; })()`;
  for (let i = 0; i < 50; i++) {
    if (await evaluate(send, find)) return;
    await sleep(200);
  }
  const seen = await evaluate(send, `[...document.querySelectorAll('[role=button],button')].map(e => e.textContent.trim()).filter(Boolean).slice(0, 30)`);
  throw new Error(`no "${label}" on the page; buttons there: ${JSON.stringify(seen)}`);
}

(async () => {
  if (!CHROME) throw new Error('no Chrome found - set CHROME');
  if (!fs.existsSync(path.join(DIR, 'index.html'))) throw new Error(`no index.html in ${DIR}`);
  await copyManifests();
  /* --serve [port]: only serve the export, for a person to open in a browser; runs until stopped */
  if (args.includes('--serve')) {
    const port = Number(opt('--serve')) || 8099;
    const s = await serve(port);
    console.log(`serving ${DIR} at http://127.0.0.1:${s.address().port}/ (Ctrl+C stops)`);
    return;
  }
  const server = await serve();
  const url = `http://127.0.0.1:${server.address().port}/`;
  const port = 9300 + Math.floor(Math.random() * 500);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'webshot-'));
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--disable-gpu', `--window-size=${WIDTH},900`, url], { stdio: 'ignore' });
  try {
    const { send, close } = await devtools(port);
    await send('Page.enable');
    await send('Runtime.enable');
    await sleep(1500);
    for (const label of taps) { await tap(send, label); await sleep(1000); }
    const height = await evaluate(send, 'Math.max(document.body.scrollHeight, ...[...document.querySelectorAll("*")].map(e => e.scrollHeight))');
    await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: Math.min(height, 6000), deviceScaleFactor: 1, mobile: false });
    await sleep(500);
    const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    fs.writeFileSync(OUT, Buffer.from(data, 'base64'));
    console.log(`${OUT} (${WIDTH}x${Math.min(height, 6000)})`);
    close();
  } finally {
    chrome.kill();
    server.close();
  }
})().catch(e => { console.error(e.message); process.exit(1); });

#!/usr/bin/env node
// A screenshot of the web app's tab in Chromium on the box, over the DevTools protocol (port 9333, webapp.sh) - the page
// alone, not the desktop around it (webapp.sh shot takes the whole screen).
//   node tools/box/page-shot.js [out.png] [--bottom=<px>]    --bottom: only the page's last <px> rows (a bar along the bottom)
'use strict';
const fs = require('fs');

const out = process.argv.slice(2).find((a) => !a.startsWith('--')) || '/tmp/page-shot.png';
const bottom = Number((process.argv.find((a) => a.startsWith('--bottom=')) || '').split('=')[1]) || 0;

(async () => {
  const pages = await (await fetch(`http://127.0.0.1:${process.env.CDP_PORT || 9333}/json`)).json();
  /* the web app's tab - local (apps.crp.to) or deployed (workers.dev) - never an open DevTools tab */
  const page = pages.find((p) => p.type === 'page' && /apps\.crp\.to|workers\.dev/.test(p.url) && !/^devtools:/.test(p.url));
  if (!page) throw new Error('no web app tab open (webapp.sh browser first)');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let n = 0;
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++n;
    const on = (ev) => { const m = JSON.parse(ev.data); if (m.id !== id) return; ws.removeEventListener('message', on); if (m.error) reject(new Error(m.error.message)); else resolve(m.result); };
    ws.addEventListener('message', on);
    ws.send(JSON.stringify({ id, method, params }));
  });
  const { cssLayoutViewport: v } = await call('Page.getLayoutMetrics');
  const clip = bottom ? { x: 0, y: v.clientHeight - bottom, width: v.clientWidth, height: bottom, scale: 1 } : undefined;
  const { data } = await call('Page.captureScreenshot', { format: 'png', ...(clip ? { clip } : {}) });
  fs.writeFileSync(out, Buffer.from(data, 'base64'));
  console.log(out);
  ws.close();
})().catch((e) => { console.error(`page-shot: ${e.message}`); process.exit(1); });

#!/usr/bin/env node
// THE APP'S PAGE IS UP - by the browser's own event, not a retry loop. Takes the browser's DevTools socket from the
// line Electron prints ("DevTools listening on ws://..."), asks for target events, and ends when a page that is not
// DevTools and not blank exists (Target.targetCreated / targetInfoChanged, or one already there). The tools that
// talk to the page (page-click, page-presser) fetch /json once and fail if it is not there yet (2026-10-31: a presser
// started on the main process's line died "fetch failed" and the run waited on it).
//   node tools/box/page-ready.js <ws://127.0.0.1:PORT/devtools/browser/ID> [idle seconds=60]
const url = process.argv[2];
if (!/^ws:\/\//.test(url || '')) { console.error('usage: page-ready.js <browser ws url> [idle]'); process.exit(2); }
const IDLE_MS = Number(process.argv[3] || 60) * 1000;
const ws = new WebSocket(url);
const isApp = (t) => t && t.type === 'page' && !/^devtools:|^about:blank$/.test(t.url || '');
/* the one timer: an inactivity cutoff - nothing happened in the browser for IDLE_MS */
let quiet = setTimeout(() => { console.error(`page-ready: no page in ${IDLE_MS / 1000} s`); process.exit(1); }, IDLE_MS);
const done = (t) => { clearTimeout(quiet); console.log(`page up: ${t.url}`); ws.close(); process.exit(0); };
ws.onopen = () => {
  ws.send(JSON.stringify({ id: 1, method: 'Target.setDiscoverTargets', params: { discover: true } }));
  ws.send(JSON.stringify({ id: 2, method: 'Target.getTargets' }));
};
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id === 2) { const t = (m.result?.targetInfos || []).find(isApp); if (t) done(t); return; }
  if (m.method === 'Target.targetCreated' || m.method === 'Target.targetInfoChanged') {
    if (isApp(m.params.targetInfo)) done(m.params.targetInfo);
  }
};
ws.onerror = (e) => { console.error(`page-ready: ${e.message || 'socket error'}`); process.exit(1); };

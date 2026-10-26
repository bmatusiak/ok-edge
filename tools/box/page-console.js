#!/usr/bin/env node
// Stream the web app's console from Chromium on the box (opened by webapp.sh with --remote-debugging-port=9333), over
// the DevTools protocol - what the page logs ([webkey], [bucket], errors) without opening DevTools by hand.
//   node tools/box/page-console.js [seconds=20] [--reload] [--filter=REGEX]
const args = process.argv.slice(2);
const seconds = Number(args.find((a) => /^\d+$/.test(a)) || 20);
const reload = args.includes('--reload');
const filter = (args.find((a) => a.startsWith('--filter=')) || '').slice(9);
const re = filter ? new RegExp(filter) : null;
(async () => {
  const pages = await (await fetch('http://127.0.0.1:9333/json')).json();
  const page = pages.find((p) => p.type === 'page' && /apps\.crp\.to/.test(p.url)) || pages.find((p) => p.type === 'page');
  if (!page) { console.error('no page open (webapp.sh browser first)'); process.exit(1); }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const send = (method, params = {}) => ws.send(JSON.stringify({ id: ++id, method, params }));
  ws.onopen = () => {
    send('Runtime.enable');
    send('Log.enable');
    if (reload) send('Page.reload', { ignoreCache: true });
  };
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    let line = null;
    if (m.method === 'Runtime.consoleAPICalled') line = `[${m.params.type}] ${m.params.args.map((a) => (a.value !== undefined ? a.value : a.description || a.type)).join(' ')}`;
    else if (m.method === 'Runtime.exceptionThrown') line = `[exception] ${m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text}`;
    else if (m.method === 'Log.entryAdded') line = `[${m.params.entry.level}] ${m.params.entry.text}`;
    if (line && (!re || re.test(line))) console.log(line.slice(0, 400));
  };
  setTimeout(() => { ws.close(); process.exit(0); }, seconds * 1000);
})().catch((e) => { console.error(String(e)); process.exit(1); });

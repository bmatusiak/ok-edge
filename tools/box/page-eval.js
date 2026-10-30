#!/usr/bin/env node
// Evaluate one expression in the app's page over the DevTools protocol and print its JSON result - for reading the
// page's own state (its storage, a store's value) without clicking through it.
//   CDP_PORT=9334 node tools/box/page-eval.js "<expression>"      (the desktop app: OKEDGE_DEVTOOLS_PORT=9334)
// The expression may be async (awaited). Read-only by intent: it is for looking, not for driving the app.
const expr = process.argv[2];
if (!expr) { console.error('usage: page-eval.js "<expression>"'); process.exit(2); }
(async () => {
  const pages = await (await fetch(`http://127.0.0.1:${process.env.CDP_PORT || 9333}/json`)).json();
  const page = pages.find((p) => p.type === 'page' && !/^devtools:/.test(p.url));
  if (!page) { console.error('no page open'); process.exit(1); }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, awaitPromise: true, returnByValue: true } }));
  ws.onmessage = (m) => {
    const r = JSON.parse(m.data);
    if (r.id !== 1) return;
    const res = r.result || {};
    if (res.exceptionDetails) console.error(res.exceptionDetails.exception?.description || res.exceptionDetails.text);
    else console.log(JSON.stringify(res.result?.value, null, 1));
    ws.close();
    process.exit(res.exceptionDetails ? 1 : 0);
  };
  setTimeout(() => { console.error('no answer in 15 s'); process.exit(1); }, 15000);
})();

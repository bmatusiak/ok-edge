#!/usr/bin/env node
// Fill one text field in the app's page from a FILE, over the DevTools protocol - for secrets a test types (a test
// backup, its passphrase) that must never pass through a command line or a log. The field is found by its placeholder.
//   CDP_PORT=9334 node tools/box/page-fill.js "<placeholder>" <file> [json key]
// With a json key the file is JSON and that key's value is used. Prints only the length filled, never the value.
// React Native Web's TextInput is controlled: setting .value alone is undone at the next render, so the value goes in
// through the element prototype's own setter and an 'input' event, which is what React listens for.
const fs = require('fs');
const [placeholder, file, key] = process.argv.slice(2);
if (!placeholder || !file) { console.error('usage: page-fill.js "<placeholder>" <file> [json key]'); process.exit(2); }
let value = fs.readFileSync(file, 'utf8');
if (key) value = JSON.parse(value)[key];
if (typeof value !== 'string' || !value) { console.error('nothing to fill from that file'); process.exit(2); }
const expr = `(() => {
  const el = [...document.querySelectorAll('input, textarea')].find((e) => e.placeholder === ${JSON.stringify(placeholder)});
  if (!el) return 'no field with that placeholder';
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return 'filled ' + el.value.length + ' chars';
})()`;
(async () => {
  const pages = await (await fetch(`http://127.0.0.1:${process.env.CDP_PORT || 9333}/json`)).json();
  const page = pages.find((p) => p.type === 'page' && !/^devtools:/.test(p.url));
  if (!page) { console.error('no page open'); process.exit(1); }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
  ws.onmessage = (m) => {
    const r = JSON.parse(m.data);
    if (r.id !== 1) return;
    const res = r.result || {};
    const out = res.exceptionDetails ? 'the fill threw' : String(res.result?.value);
    console.log(out);
    ws.close();
    process.exit(/^filled/.test(out) ? 0 : 1);
  };
  setTimeout(() => { console.error('no answer in 15 s'); process.exit(1); }, 15000);
})();

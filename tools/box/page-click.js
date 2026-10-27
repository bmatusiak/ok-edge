#!/usr/bin/env node
// Click the web app in Chromium on the box by what a control SAYS, over the DevTools protocol (port 9333, webapp.sh) -
// no screen coordinates. Each label is found as a visible element whose aria-label is that label (--labels shows these
// as [label]), or else the innermost visible element whose text is exactly that label; a real
// mouse press and release go to its centre (React Native Web's Pressable answers pointer events, not element.click()).
//   node tools/box/page-click.js "Create Bucket" [wait:2] ["Passwords" ...]   click in turn
//   node tools/box/page-click.js --labels                                     what is on screen, clicking nothing
//   node tools/box/page-click.js --text [chars=3000]                          the page's visible text
//   node tools/box/page-click.js --eval 'EXPR'                                EXPR's value in the page, as JSON
// A label not on screen fails, naming what is.
const args = process.argv.slice(2);

/* in the page: the visible text controls, or the centre of the one saying `label` */
const FIND = (label) => `(() => {
  const seen = [], want = ${JSON.stringify(label)};
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') continue;
    /* an icon button says what it is only in its aria-label (React Native's accessibilityLabel) */
    const aria = el.getAttribute('aria-label');
    if (aria && want !== null && aria === want) return {x: r.left + r.width / 2, y: r.top + r.height / 2};
    if (aria) seen.push('[' + aria + ']');
    const t = (el.innerText || '').trim();
    if (!t || [...el.children].some((c) => (c.innerText || '').trim() === t)) continue;
    if (want !== null && t === want) return {x: r.left + r.width / 2, y: r.top + r.height / 2};
    if (t.length <= 40 && !t.includes('\\n')) seen.push(t);
  }
  return {seen: [...new Set(seen)]};
})()`;

(async () => {
  const pages = await (await fetch(`http://127.0.0.1:${process.env.CDP_PORT || 9333}/json`)).json();
  /* the web app's tab - local (apps.crp.to) or deployed (workers.dev) - never an open DevTools tab */
  const page = pages.find((p) => p.type === 'page' && /apps\.crp\.to|workers\.dev/.test(p.url) && !/^devtools:/.test(p.url))
    || pages.find((p) => p.type === 'page' && !/^devtools:/.test(p.url));
  if (!page) throw new Error('no page open (webapp.sh browser first)');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0;
  const waiting = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
  };
  const call = (method, params = {}) => new Promise((resolve) => { waiting.set(++id, resolve); ws.send(JSON.stringify({ id, method, params })); });
  const evaluate = async (expr) => (await call('Runtime.evaluate', { expression: expr, returnByValue: true })).result.result.value;

  if (args[0] === '--eval') {
    /* an expression in the page (awaited), its value as JSON - storage, state, what a screen holds */
    const r = await call('Runtime.evaluate', { expression: args[1], returnByValue: true, awaitPromise: true });
    console.log(r.result.exceptionDetails ? `threw: ${r.result.exceptionDetails.exception?.description}` : JSON.stringify(r.result.result.value));
  } else if (args[0] === '--text') {
    /* the page's visible text, bounded: an error message is longer than a label */
    console.log(String(await evaluate('document.body.innerText')).slice(0, Number(args[1]) || 3000));
  } else if (args[0] === '--labels') {
    console.log((await evaluate(FIND(null))).seen.join(' | '));
  } else {
    for (const a of args) {
      if (a.startsWith('wait:')) { await new Promise((r) => setTimeout(r, Number(a.slice(5)) * 1000)); continue; }
      const at = await evaluate(FIND(a));
      if (!at || at.x === undefined) throw new Error(`"${a}" is not on screen; there: ${(at?.seen || []).join(' | ')}`);
      for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
        await call('Input.dispatchMouseEvent', { type, x: at.x, y: at.y, button: 'left', clickCount: type === 'mouseMoved' ? 0 : 1 });
      }
      console.log(`clicked "${a}"`);
    }
  }
  ws.close();
  process.exit(0);
})().catch((e) => { console.error(String(e.message || e)); process.exit(1); });

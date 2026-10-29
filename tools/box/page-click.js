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

/*
 * in the page: the visible text controls, or the centre of the one saying `label` - and whether it is DISABLED (it or
 * the control around it: aria-disabled, React Native Web's disabled Pressable). A click on a disabled control does
 * nothing and says nothing (2026-10-28: "Agent: request a budget" clicked in the moment the tab was busy - no request,
 * and the run waited for a sheet that was never coming), so the click waits for it to be enabled.
 */
const FIND = (label) => `(() => {
  const seen = [], want = ${JSON.stringify(label)};
  const off = (el) => !!el.closest('[aria-disabled="true"], button:disabled');
  /* the centre of a control INSIDE the window: one below the fold is scrolled into view first - a mouse event at
   * coordinates off the screen hits nothing (2026-10-28: the request button at the foot of the open Edge Management) */
  const at = (el) => { el.scrollIntoView({block: 'center', inline: 'center'}); const q = el.getBoundingClientRect(); return {x: q.left + q.width / 2, y: q.top + q.height / 2, disabled: off(el)}; };
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') continue;
    /* an icon button says what it is only in its aria-label (React Native's accessibilityLabel) */
    const aria = el.getAttribute('aria-label');
    if (aria && want !== null && aria === want) return at(el);
    if (aria) seen.push('[' + aria + ']');
    const t = (el.innerText || '').trim();
    if (!t || [...el.children].some((c) => (c.innerText || '').trim() === t)) continue;
    if (want !== null && t === want) return at(el);
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
      let at = await evaluate(FIND(a));
      if (!at || at.x === undefined) throw new Error(`"${a}" is not on screen; there: ${(at?.seen || []).join(' | ')}`);
      /* a disabled control: wait for it (the tab's own work with the key ends), up to 10 s, then say so */
      for (let n = 0; at && at.disabled && n < 50; n++) {
        await new Promise((r) => setTimeout(r, 200));
        at = await evaluate(FIND(a));
        if (!at || at.x === undefined) throw new Error(`"${a}" left the screen while it was disabled`);
      }
      if (at.disabled) throw new Error(`"${a}" stayed disabled for 10 s - not clicked`);
      for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
        await call('Input.dispatchMouseEvent', { type, x: at.x, y: at.y, button: 'left', clickCount: type === 'mouseMoved' ? 0 : 1 });
      }
      console.log(`clicked "${a}"`);
    }
  }
  ws.close();
  process.exit(0);
})().catch((e) => { console.error(String(e.message || e)); process.exit(1); });

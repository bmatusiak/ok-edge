#!/usr/bin/env node
// Click the web app in Chromium on the box by what a control SAYS, over the DevTools protocol (port 9333, webapp.sh) -
// no screen coordinates. Each label is found as a visible element whose aria-label is that label (--labels shows these
// as [label]), or else the innermost visible element whose text is exactly that label; a real
// mouse press and release go to its centre (React Native Web's Pressable answers pointer events, not element.click()).
//   node tools/box/page-click.js "Create Bucket" ["Passwords" ...] ["?Done"]     click in turn; ?Label waits for it, no click
//   node tools/box/page-click.js --labels                                     what is on screen, clicking nothing
//   node tools/box/page-click.js --text [chars=3000]                          the page's visible text
//   node tools/box/page-click.js --eval 'EXPR'                                EXPR's value in the page, as JSON
// A label not on screen fails, naming what is.
// --life N: each control's watchdog, seconds from the start of its wait (default 30)
const argv = process.argv.slice(2);
const lifeAt = argv.indexOf('--life');
const LIFE = lifeAt < 0 ? 30 : Number(argv[lifeAt + 1]);
const args = lifeAt < 0 ? argv : argv.filter((_, i) => i !== lifeAt && i !== lifeAt + 1);

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
  /* covered: something else is on top at the centre (a sheet's backdrop: the wait-for-the-key sheet, 2026-10-28) -
   * a click there reaches the cover, not the control, so it waits like a disabled one */
  const at = (el) => {
    el.scrollIntoView({block: 'center', inline: 'center'});
    const q = el.getBoundingClientRect();
    const x = q.left + q.width / 2, y = q.top + q.height / 2;
    const hit = document.elementFromPoint(x, y);
    const control = el.closest('[role="button"], button, a') || el;
    const covered = !hit || !(control.contains(hit) || hit.contains(control));
    return {x, y, disabled: off(el) || covered, covered};
  };
  /*
   * EVERY MATCH, THE FIRST LIVE ONE WINS. Two controls can say the same thing - "Press the soft key" on the request
   * card and on the press sheet above it (2026-10-31). Taking the first in the page took the card's, covered by the
   * sheet, and waited for it until the key gave up at 20 s and the sheet went - the press then landed after the
   * window and the key said "button press was not accepted", every time. A match that is covered or disabled is
   * used only when no other is live (and then waited on, as before).
   */
  let first = null;
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') continue;
    /* an icon button says what it is only in its aria-label (React Native's accessibilityLabel) */
    const aria = el.getAttribute('aria-label');
    let hit = aria && want !== null && aria === want;
    if (aria) seen.push('[' + aria + ']');
    const t = (el.innerText || '').trim();
    if (!hit && (!t || [...el.children].some((c) => (c.innerText || '').trim() === t))) continue;
    if (!hit && want !== null && t === want) hit = true;
    if (hit) {
      const a = at(el);
      if (!a.disabled) return a;
      first = first || el;
      continue;
    }
    if (t.length <= 40 && !t.includes('\\n')) seen.push(t);
  }
  if (first) return at(first);
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
  } else if (args[0] === '--has') {
    /* a PRECHECK: is it on screen now (live or not)? exit 0 yes, 1 no - no waiting, no click */
    const at = await evaluate(FIND(args[1]));
    const there = !!(at && at.x !== undefined);
    console.log(there ? `has: "${args[1]}"` : `has not: "${args[1]}"`);
    ws.close();
    process.exit(there ? 0 : 1);
  } else if (args[0] === '--labels') {
    console.log((await evaluate(FIND(null))).seen.join(' | '));
  } else {
    for (const arg of args) {
      if (arg.startsWith('wait:')) { await new Promise((r) => setTimeout(r, Number(arg.slice(5)) * 1000)); continue; }
      /* "?Label": wait until it is there and live, click nothing - a step's end the page shows ("Restart the app") */
      const only = arg.startsWith('?');
      const a = only ? arg.slice(1) : arg;
      /*
       * THERE AND LIVE, BY EVENT (Brad, 2026-10-31: "your script should be event based, not timer based"): a
       * MutationObserver in the page looks again on each change - the control appearing, waking from disabled, its
       * cover (a sheet) going - instead of a poll every 200 ms.
       * THE WATCHDOG (Brad, 2026-10-31: "an event has an expected end of life"): LIFE seconds from the start of the
       * wait, not reset by changes - a "quiet" cutoff that each change reset never fired on a busy page, and a PIN
       * click waited on a covered button for good.
       */
      let at = await evaluate(FIND(a));
      if (!at || at.x === undefined || at.disabled) {
        const r = await call('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `new Promise((resolve) => {
          const find = () => { const f = ${FIND(a)}; return f && f.x !== undefined && !f.disabled ? f : null; };
          const done = (v) => { obs.disconnect(); clearTimeout(life); resolve(v); };
          const life = setTimeout(() => done(null), ${LIFE * 1000});
          const obs = new MutationObserver(() => { const f = find(); if (f) done(f); });
          obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
          const f = find(); if (f) done(f);
        })` });
        at = r.result.result.value || await evaluate(FIND(a));
      }
      if (!at || at.x === undefined) throw new Error(`WATCHDOG: "${a}" not on screen in ${LIFE} s; there: ${(at?.seen || []).join(' | ')}`);
      if (at.disabled) throw new Error(`WATCHDOG: "${a}" still ${at.covered ? 'covered' : 'disabled'} after ${LIFE} s - not clicked`);
      if (only) { console.log(`there: "${a}"`); continue; }
      for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
        await call('Input.dispatchMouseEvent', { type, x: at.x, y: at.y, button: 'left', clickCount: type === 'mouseMoved' ? 0 : 1 });
      }
      console.log(`clicked "${a}"`);
    }
  }
  ws.close();
  process.exit(0);
})().catch((e) => { console.error(String(e.message || e)); process.exit(1); });

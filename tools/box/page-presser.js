#!/usr/bin/env node
// PRESS WHEN THE APP SAYS SO - event driven, no polling (Brad, 2026-10-31: "your script should be event based, not
// timer based ... if a timer is used you will always fail"). Listens to the desktop app's console over the DevTools
// protocol and answers each sheet the moment the app logs it LIVE (src/ui/PressSheet.tsx Locate):
//   [press] sheet up: <what> - button at X,Y      -> a click at X,Y (device pixels / devicePixelRatio)
//   [press] sheet up: derive code A B C - ...     -> the digits A, B, C on the code sheet's keypad, in order
// An approval ("... - approve", the Edge request sheet) is answered only with --approve, and only on the TESTNET (the
// page's TESTNET banner): automation is for TEST budgets alone.
// Every console line it acts on, and every line matching --show, is printed as it comes. It ends on --until <regex>
// (a console line) - or its WATCHDOG fires: --life seconds from its start is the step's expected end of life (Brad,
// 2026-10-31: "you need a watch dog inactivity timer, so an event has an expected end of life"). Other lines do not
// reset it - the app logs all the time, and an idle cutoff they reset never fired. On expiry it prints the last lines
// it saw and the buttons on screen, and exits 1.
//   CDP_PORT=9334 node tools/box/page-presser.js [--approve] [--until 'REGEX'] [--life 90] [--show 'REGEX']
const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); return i < 0 ? dflt : args[i + 1]; };
const APPROVE = args.includes('--approve');
const UNTIL = opt('--until', null) ? new RegExp(opt('--until')) : null;
const LIFE_MS = Number(opt('--life', 90)) * 1000;
const SHOW = opt('--show', null) ? new RegExp(opt('--show')) : null;
const say = (s) => console.log(`${new Date().toTimeString().slice(0, 8)} ${s}`);

(async () => {
  const pages = await (await fetch(`http://127.0.0.1:${process.env.CDP_PORT || 9333}/json`)).json();
  const page = pages.find((p) => p.type === 'page' && !/^devtools:/.test(p.url));
  if (!page) throw new Error('no page open');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0;
  const waiting = new Map();
  /* the handler first: a call made before it was set never heard its answer (the presser hung before "listening") */
  let onConsole = () => {};
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); return; }
    if (m.method === 'Runtime.consoleAPICalled') onConsole(m);
  };
  const call = (method, params = {}) => new Promise((resolve) => { waiting.set(++id, resolve); ws.send(JSON.stringify({ id, method, params })); });
  const evaluate = async (expr) => (await call('Runtime.evaluate', { expression: expr, returnByValue: true })).result.result.value;
  const click = async (x, y) => {
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
      await call('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: type === 'mouseMoved' ? 0 : 1 });
    }
  };
  /* a live, uncovered button whose text is exactly `label`: the code sheet's digits (the page under it has a keypad too) */
  const centreOf = (label) => evaluate(`(() => {
    for (const el of [...document.querySelectorAll('[role="button"], button')].reverse()) {
      if ((el.innerText || '').trim() !== ${JSON.stringify(label)} || el.closest('[aria-disabled="true"]')) continue;
      const q = el.getBoundingClientRect();
      if (!q.width) continue;
      const x = q.left + q.width / 2, y = q.top + q.height / 2, hit = document.elementFromPoint(x, y);
      if (hit && (el.contains(hit) || hit.contains(el))) return {x, y};
    }
    return null;
  })()`);
  const dpr = (await evaluate('window.devicePixelRatio')) || 1;

  const recent = [];
  const finish = (code, why) => { say(why); ws.close(); process.exit(code); };
  /* the watchdog - the step's expected end of life, the one timer */
  setTimeout(async () => {
    say(`WATCHDOG: no outcome in ${LIFE_MS / 1000} s${UNTIL ? ` (waited for /${UNTIL.source}/)` : ''} - the last lines:`);
    for (const l of recent) console.log(`  ${l}`);
    const seen = await evaluate(`[...document.querySelectorAll('[role="button"], button')].map((b) => (b.getAttribute('aria-label') || b.innerText || '').trim()).filter(Boolean).slice(-12).join(' | ')`).catch(() => '?');
    console.log(`  buttons now: ${seen}`);
    finish(1, 'watchdog');
  }, LIFE_MS);

  /* one sheet at a time, in the order the app announced them */
  let chain = Promise.resolve();
  const act = (fn) => { chain = chain.then(fn).catch((e) => say(`failed: ${e.message || e}`)); };

  onConsole = (m) => {
    const line = (m.params.args || []).map((a) => (a.value !== undefined ? String(a.value) : a.description || '')).join(' ');
    recent.push(line.slice(0, 160)); if (recent.length > 8) recent.shift();
    if (SHOW && SHOW.test(line)) say(line.slice(0, 200));
    const up = line.match(/^\[press\] sheet up: (.*) - button at (\d+),(\d+)$/);
    if (up) {
      const [, what, x, y] = up;
      const code = what.match(/^derive code ([1-6]) ([1-6]) ([1-6])$/);
      if (/ - approve$/.test(what)) {
        if (!APPROVE) { say(`sheet up: ${what} - left for a person (no --approve)`); }
        else act(async () => {
          const net = await evaluate(`document.body.innerText.includes('TESTNET')`);
          if (!net) { say(`sheet up: ${what} - NOT the testnet, left for a person`); return; }
          await click(Number(x) / dpr, Number(y) / dpr);
          say(`approved: ${what}`);
        });
      } else if (code) {
        act(async () => {
          for (const d of code.slice(1)) {
            const at = await centreOf(d);
            if (!at) throw new Error(`the code's digit ${d} is not a live button`);
            await click(at.x, at.y);
          }
          say(`entered the code ${code.slice(1).join(' ')}`);
        });
      } else {
        act(async () => { await click(Number(x) / dpr, Number(y) / dpr); say(`pressed: ${what}`); });
      }
    } else if (/^\[press\] tap .*not sent/.test(line)) {
      say(`the app did not send it: ${line.slice(12, 160)}`);
    }
    if (UNTIL && UNTIL.test(line)) act(async () => finish(0, `until: ${line.slice(0, 160)}`));
  };
  await call('Runtime.enable');
  say(`listening${APPROVE ? ' (testnet approvals too)' : ''}${UNTIL ? ` until /${UNTIL.source}/` : ''}`);
})().catch((e) => { console.error(`page-presser: ${e.message || e}`); process.exit(1); });

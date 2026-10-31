#!/usr/bin/env node
// PRESS WHEN THE APP SAYS SO - event driven, no polling (Brad, 2026-10-31: "your script should be event based, not
// timer based ... if a timer is used you will always fail"). Listens to the desktop app's console over the DevTools
// protocol and answers each sheet the moment the app logs it LIVE (src/ui/PressSheet.tsx Locate):
//   [press] sheet up: <what> - button at X,Y      -> a click at X,Y (device pixels / devicePixelRatio)
//   [press] sheet up: derive code A B C - ...     -> the digits A, B, C on the code sheet's keypad, in order
// An approval ("... - approve", the Edge request sheet) is answered only with --approve, and only on the TESTNET (the
// page's TESTNET banner): automation is for TEST budgets alone.
// Every console line it acts on, and every line matching --show, is printed as it comes. It ends on --until <regex>
// (a console line), or after --idle seconds with no console line at all - the one timer, an inactivity cutoff.
//   CDP_PORT=9334 node tools/box/page-presser.js [--approve] [--until 'REGEX'] [--idle 120] [--show 'REGEX']
const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); return i < 0 ? dflt : args[i + 1]; };
const APPROVE = args.includes('--approve');
const UNTIL = opt('--until', null) ? new RegExp(opt('--until')) : null;
const IDLE_MS = Number(opt('--idle', 120)) * 1000;
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

  let quiet;
  const finish = (code, why) => { say(why); ws.close(); process.exit(code); };
  const idle = () => { clearTimeout(quiet); quiet = setTimeout(() => finish(1, `no console line for ${IDLE_MS / 1000} s - stopping`), IDLE_MS); };
  idle();

  /* one sheet at a time, in the order the app announced them */
  let chain = Promise.resolve();
  const act = (fn) => { chain = chain.then(fn).catch((e) => say(`failed: ${e.message || e}`)); };

  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); return; }
    if (m.method !== 'Runtime.consoleAPICalled') return;
    const line = (m.params.args || []).map((a) => (a.value !== undefined ? String(a.value) : a.description || '')).join(' ');
    idle();
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

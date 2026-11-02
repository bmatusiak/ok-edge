'use strict';
/*
 * REHEARSALS IN MAESTRO'S YAML, RUN BY THE DRIVE (Brad, 2026-11-01: "build our rehearsals in YAML like how maestro does";
 * "i dont want to use maestro but use their API and follow their docs and use our own code behind that runs all the
 * platforms"; "we use what we have that works for us, not exactly how maestro does it").
 *
 * The file is Maestro's (docs.maestro.dev): a header (appId, name, tags, env), `---`, then a list of commands, `${...}`
 * for env and JavaScript. Behind each command is the drive - the same code on the desktop, the web app and the phone
 * (--app picks the platform). Maestro's commands, as far as they fit ours:
 *   launchApp  stopApp  killApp  tapOn  assertVisible  assertNotVisible  extendedWaitUntil  waitForAnimationToEnd
 *   inputText  copyTextFrom  takeScreenshot  runFlow  runScript  evalScript  assertTrue  repeat  retry
 * and ours, where what works for us is not a Maestro command:
 *   login {pin}       the drive's login (flows.login: every state the app can be in, the card included)
 *   budget {times}    one budget approved and its three signs (flows.budget)
 *   goto: <tab>       the tab through the menu, the app's own flag saying it shows
 *   waitForLog        a line the app logs (a regex) - events, not the screen: Maestro has no log
 *   waitForTap        a sheet waiting for the person's tap (the app's "[tap] wanted: <what> - choices ...", src/ui/tapWanted.ts);
 *                     `what` a regex its words must match, `timeout` in ms - the flow's next tapOn answers it
 *   machine           an action of a machine the drive reaches (targets.js): keys, key-state, tool, hex, flash ...
 *
 * WHAT IS OURS UNDER MAESTRO'S NAMES (not exactly how Maestro does it):
 * - a selector's text is a regex matched against the WHOLE label of a live control (tapOn) or a control or a line of
 *   the screen's text (the visible checks) - the app's registry, not an accessibility tree. `id` is a label too.
 * - waits are the drive's: a quiet-time watchdog, restarted by each line the app logs (until) - a timeout here is
 *   seconds of quiet, not a wall clock. assertVisible waits 7 s of quiet, as Maestro's default 7 s.
 * - presses are never written in a flow: the drive presses a test key when the app shows its press icon or a code
 *   (server.js) - a production key has no debug console and is never pressed.
 * - runScript's file runs as an async function (await is allowed) with env as variables, `output`, `maestro`
 *   (copiedText, platform) and `drive` (the drive's API: waitForLog, machine, say, app, shot).
 * An unknown command fails the flow by its name - nothing is skipped silently.
 *
 * ONE NAME PER FLOW, A FILE PER PLATFORM ONLY WHERE IT DIFFERS (Brad, 2026-11-01: "if a flow is different between
 * platforms we use .platform.yaml, so we still call flow without platform and it runs on the intended platform - generic
 * flows that exist between platforms are not redundant"): the app's own file naming (x.android.ts / x.desktop.ts /
 * x.webapp.ts). A flow or script is always named plainly - `rehearse login`, `runFlow: login.yaml`, `runScript:
 * scripts/x.js` - and `login.<shell>.yaml` (android / desktop / webapp) runs in its place on that shell when it exists,
 * else `login.yaml`. No `when: platform` branches inside a shared flow, no copy per platform.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const yaml = require('js-yaml');
const { login, budget } = require('../flows');

const PLATFORM = { android: 'Android', webapp: 'Web', desktop: 'Desktop' };
const SHELLS = Object.keys(PLATFORM);

/**
 * The file a plain name means on this shell: name.<shell>.ext beside it when there is one, else the name itself. A name
 * that already names a shell (login.android.yaml) is taken as written.
 */
function forShell(file, shell) {
  const ext = path.extname(file);
  const base = file.slice(0, -ext.length);
  if (SHELLS.some((sh) => base.endsWith(`.${sh}`))) return file;
  const own = `${base}.${shell}${ext}`;
  return fs.existsSync(own) ? own : file;
}

/* a flow file: the header and the commands, as Maestro writes them (a lone list is commands with no header) */
function loadFlow(file) {
  const docs = yaml.loadAll(fs.readFileSync(file, 'utf8')).filter((x) => x !== null && x !== undefined);
  let config = {};
  let commands;
  if (docs.length >= 2) [config, commands] = docs;
  else if (Array.isArray(docs[0])) [commands] = docs;
  if (!Array.isArray(commands)) throw new Error(`${file}: no commands - a header, a line "---", then a list`);
  return { file, dir: path.dirname(file), config: config || {}, commands };
}

/* the one key of a command entry: "- launchApp" or "- tapOn: ..." */
const nameOf = (c) => (typeof c === 'string' ? c : Object.keys(c || {})[0]);
const argOf = (c) => (typeof c === 'string' ? undefined : c[nameOf(c)]);

function createRunner(d, { say = (t) => d.say(t) } = {}) {
  const output = {};
  const maestro = { copiedText: null, platform: PLATFORM[d.app.shell] || d.app.shell };
  let focused = null;
  /*
   * THE APP'S LINES SINCE THE STEP BEFORE: a line can come while the previous step still runs (the Edge sync finishing
   * during goto) - waitForLog reads those first, then waits for new ones. Each connection the drive gets (a restart, a
   * reload) is listened to once.
   */
  const seen = [];
  const heard = new WeakSet();
  let prevStart = Date.now();
  let stepStart = Date.now();
  const listen = () => { if (!heard.has(d.app)) { heard.add(d.app); d.app.on('log', (l) => seen.push({ at: Date.now(), l: String(l) })); } };

  /* ${...}: a name from env, else JavaScript over env, output and maestro */
  const evalIn = (expr, env) => vm.runInNewContext(expr, { ...env, output, maestro, Math, JSON, Number, String, parseInt });
  const interp = (v, env) => {
    if (typeof v === 'string') {
      const whole = v.match(/^\$\{([^}]+)\}$/);
      if (whole) return evalIn(whole[1], env);
      return v.replace(/\$\{([^}]+)\}/g, (_, e) => String(evalIn(e, env)));
    }
    if (Array.isArray(v)) return v.map((x) => interp(x, env));
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === 'commands' ? x : interp(x, env)]));
    return v;
  };

  const selectorOf = (s) => (typeof s === 'string' ? { text: s } : s || {});
  const wholeRe = (t) => new RegExp(`^(?:${t})$`);
  /* a live control whose whole label matches */
  const controlFor = (sel) => {
    const re = wholeRe(sel.text || sel.id);
    const hits = d.app.controls.filter((c) => c.enabled && re.test(c.label));
    return hits[sel.index || 0] || null;
  };
  /* visible: a live control, or a line of the screen's text */
  const visible = (sel) => {
    if (controlFor(sel)) return true;
    const re = wholeRe(sel.text || sel.id);
    return d.app.text.split('\n').some((l) => re.test(l.trim()));
  };
  const waitFor = async (test, life, what) => {
    await d.until(() => test(), { life, fail: [] }).catch((e) => { throw new Error(`${what}: ${e.message.split('\n')[0]}`); });
  };
  /* when: visible / notVisible / true / platform - all of them (Maestro: AND) */
  const holds = (when, env) => {
    if (!when) return true;
    const w = interp(when, env);
    if (w.visible !== undefined && !visible(selectorOf(w.visible))) return false;
    if (w.notVisible !== undefined && visible(selectorOf(w.notVisible))) return false;
    if (w.true !== undefined && !w.true) return false;
    if (w.platform !== undefined && String(w.platform).toLowerCase() !== String(maestro.platform).toLowerCase()) return false;
    return true;
  };

  /* runScript's `drive`: the drive's own API, for what YAML does not say */
  const driveApi = () => ({
    say: (t) => say(String(t)),
    get app() { return { shell: d.app.shell, net: d.app.net, flags: d.app.flags, labels: d.app.liveLabels(), text: d.app.text }; },
    waitForLog: (re, seconds = 60) => d.until(re instanceof RegExp ? re : new RegExp(re), { life: seconds, fail: [] }),
    machine: (action, target = d.app.shell, args = {}) => d.machine(action, target, args),
    everywhere: (action, args) => d.everywhere(action, args),
    shot: (name) => d.shot(name),
  });

  async function runList(commands, env, dir) {
    for (const c of commands) await run(c, env, dir);
  }

  async function runFile(named, env) {
    const file = forShell(named, d.app.shell);
    if (file !== named) say(`${path.basename(named)}: ${path.basename(file)} on ${maestro.platform}`);
    const f = loadFlow(file);
    const flowEnv = { ...interp(f.config.env || {}, env), ...env };
    say(`flow ${f.config.name || path.basename(file)}${f.config.appId ? ` (${f.config.appId})` : ''} on ${maestro.platform}`);
    await runList(f.commands, flowEnv, f.dir);
  }

  async function run(c, env, dir) {
    const name = nameOf(c);
    const raw = argOf(c);
    const optional = raw && typeof raw === 'object' && raw.optional === true;
    const label = raw && typeof raw === 'object' && raw.label;
    try {
      await exec(name, raw, env, dir);
    } catch (e) {
      if (optional) { say(`${label || name}: optional - ${String(e.message).split('\n')[0]}`); return; }
      throw new Error(`${label || name}: ${e.message}`);
    }
  }

  async function exec(name, raw, env, dir) {
    listen();
    prevStart = stepStart;
    stepStart = Date.now();
    const a = interp(raw, env);
    switch (name) {
      case 'launchApp': {
        if (a && a.clearState) throw new Error('clearState: not here - the app keeps the key\'s copies; wipe on purpose (machine tool)');
        d = await d.up();
        listen();
        return;
      }
      case 'stopApp':
      case 'killApp':
        await d.stop(d.app.shell);
        return;
      case 'tapOn': {
        const sel = selectorOf(a);
        let target = null;
        /* timeout: seconds to wait for the control (30) - an optional step that may find nothing waits less (ours) */
        await waitFor(() => (target = controlFor(sel)) !== null, Number(sel.timeout) || 30, `no live control "${sel.text || sel.id}"`);
        for (let i = 0; i < (sel.repeat || 1); i++) {
          if (i) await new Promise((r) => setTimeout(r, sel.delay || 100));
          await d.tap(target.label);
        }
        focused = target.label;
        return;
      }
      case 'assertVisible':
        await waitFor(() => visible(selectorOf(a)), 7, `not visible: "${selectorOf(a).text}"`);
        return;
      case 'assertNotVisible':
        await waitFor(() => !visible(selectorOf(a)), 7, `still visible: "${selectorOf(a).text}"`);
        return;
      case 'extendedWaitUntil': {
        const life = Math.max(1, Math.round((a.timeout || 7000) / 1000));
        if (a.visible !== undefined) await waitFor(() => visible(selectorOf(a.visible)), life, `not visible in ${life} s of quiet`);
        if (a.notVisible !== undefined) await waitFor(() => !visible(selectorOf(a.notVisible)), life, `still visible after ${life} s of quiet`);
        return;
      }
      case 'waitForAnimationToEnd':
        await waitFor(() => d.app.settled(), 15, 'the app did not settle');
        return;
      case 'inputText': {
        const text = typeof a === 'object' ? a.text : a;
        const field = (typeof a === 'object' && a.field) || focused;
        if (!field) throw new Error('no field: tapOn one first, or inputText {text, field}');
        await d.fill(field, String(text));
        return;
      }
      case 'copyTextFrom': {
        const re = wholeRe(selectorOf(a).text);
        const line = d.app.text.split('\n').map((l) => l.trim()).find((l) => re.test(l)) || (controlFor(selectorOf(a)) || {}).label;
        if (!line) throw new Error(`nothing shows "${selectorOf(a).text}"`);
        maestro.copiedText = line;
        return;
      }
      case 'takeScreenshot':
        await d.shot(typeof a === 'object' ? a.path : a);
        return;
      case 'runFlow': {
        const spec = typeof a === 'string' ? { file: a } : a;
        if (!holds(spec.when, env)) { say(`${spec.label || spec.file || 'runFlow'}: skipped (when)`); return; }
        const sub = { ...env, ...(spec.env || {}) };
        if (spec.file) await runFile(path.resolve(dir, spec.file), sub);
        else await runList(raw.commands || [], sub, dir);
        return;
      }
      case 'runScript': {
        const spec = typeof a === 'string' ? { file: a } : a;
        if (!holds(spec.when, env)) return;
        const file = forShell(path.resolve(dir, spec.file), d.app.shell);
        const code = fs.readFileSync(file, 'utf8');
        const ctx = vm.createContext({ ...env, ...(spec.env || {}), output, maestro, drive: driveApi(), console: { log: (...x) => say(x.join(' ')) }, setTimeout, Promise, JSON, Math, RegExp, Date });
        await vm.runInContext(`(async () => {\n${code}\n})()`, ctx, { filename: file });
        return;
      }
      case 'evalScript':
        /* "${...}": already evaluated by interp */
        return;
      case 'assertTrue': {
        const v = typeof a === 'object' && a !== null ? a.condition : a;
        if (!v || v === 'false') throw new Error(`not true: ${JSON.stringify(raw)}`);
        return;
      }
      case 'repeat': {
        const times = a.times !== undefined ? Number(a.times) : Infinity;
        for (let i = 0; i < times && i < 1000; i++) {
          if (raw.while && !holds(raw.while, env)) break;
          await runList(raw.commands || [], env, dir);
        }
        return;
      }
      case 'retry': {
        const max = a.maxRetries !== undefined ? Number(a.maxRetries) : 1;
        for (let n = 0; ; n++) {
          try { await (a.file ? runFile(path.resolve(dir, a.file), env) : runList(raw.commands || [], env, dir)); return; } catch (e) {
            if (n >= max) throw e;
            say(`retry ${n + 1} of ${max}: ${String(e.message).split('\n')[0]}`);
          }
        }
      }
      /* ---- ours ---- */
      case 'login':
        /* key: soft - the desktop's own testnet soft key, never the gadget (the dev loop's key) */
        d = await login(d, { ...(a && a.pin ? { pin: String(a.pin) } : {}), ...(a && a.key ? { key: String(a.key) } : {}) });
        listen();
        return;
      case 'budget':
        for (let i = 1; i <= Number((a && a.times) || 1); i++) await budget(d);
        return;
      case 'goto':
        await d.goto(String(a));
        return;
      case 'waitForTap': {
        /* a sheet asks the person (Approve / Decline): the app's own signal, not a guess from the screen - signal only, the flow taps */
        const spec = typeof a === 'string' ? { what: a } : (a || {});
        const life = Math.max(1, Math.round((spec.timeout || 60000) / 1000));
        const want = spec.what ? new RegExp(spec.what) : null;
        const re = /^\[tap\] wanted: (.*) - choices (.*)$/;
        const hit = (l) => { const m = l.match(re); return m && (!want || want.test(m[1])) ? m : null; };
        const early = seen.find((x) => x.at >= prevStart && hit(x.l));
        /* d.until returns the matching line only for a regex goal: the wait's words in a lookahead */
        const goal = new RegExp(`^\\[tap\\] wanted: ${spec.what ? `(?=.*(?:${spec.what}))` : ''}`);
        const got = early ? early.l : await d.until(goal, { life, fail: [] }).catch((e) => { throw new Error(`no tap wanted${spec.what ? ` (/${spec.what}/)` : ''}: ${e.message.split('\n')[0]}`); });
        const m = hit(String(got));
        if (m) say(`a tap is wanted: ${m[1]} - ${m[2]}`);
        if (spec.as) output[spec.as] = m ? m[1] : got;
        return;
      }
      case 'waitForLog': {
        const spec = typeof a === 'string' ? { pattern: a } : a;
        const life = Math.max(1, Math.round((spec.timeout || 60000) / 1000));
        const re = new RegExp(spec.pattern);
        const early = seen.find((x) => x.at >= prevStart && re.test(x.l));
        if (early) { if (spec.as) output[spec.as] = early.l; return; }
        /*
         * A FAILED KEY REQUEST ENDS THE WAIT AT ONCE (Brad, 2026-11-01: "it did end, waiting on nothing! red flag" - the
         * loss's request failed at 20:32:53 and the flow waited out 60 s of quiet for its success line): the app's own
         * "[timeline] ... end ... failed" or "the key stopped waiting for the press", since the step before or while
         * waiting. `failOn` names another failure; `failOn: none` waits as before.
         */
        const failRe = spec.failOn === 'none' ? null : new RegExp(spec.failOn || '\\[timeline\\] \\d+ end #\\d+ .* failed|the key stopped waiting for the press');
        /*
         * A FAILURE THE APP HANDLES IS GIVEN GRACE_MS (box desktop, 2026-11-01: a plan's budget end "failed" - the key had
         * already ended it, which the lib takes as done - and the plan's "done" came 1 ms later; the wait had stopped on
         * the failure): the wanted line within GRACE_MS of a failure passes the step; past it, the failure ends it.
         */
        const GRACE_MS = 3000;
        let stopFail = false;
        const graceThen = (l, at = Date.now()) => new Promise((_, rej) => setTimeout(() => {
          if (!stopFail) rej(new Error(`no log line /${spec.pattern}/ - the app failed: ${String(l).slice(0, 200)}`));
        }, Math.max(0, at + GRACE_MS - Date.now())));
        const failedEarly = failRe && seen.find((x) => x.at >= prevStart && failRe.test(x.l));
        const failed = !failRe ? new Promise(() => {})
          : failedEarly ? graceThen(failedEarly.l, failedEarly.at)
          : d.until(failRe, { life, fail: [] }).then((l) => graceThen(l), () => new Promise(() => {}));
        /*
         * AND WHEN THE APP GOES IDLE WITHOUT IT (Brad, 2026-11-01: "i see it, doing nothing, waiting, i have enough time
         * to complain before you got the results back"): the watchdog's quiet is reset by every line, and the gadget's
         * firmware console never stops - so a wait ran a minute and more after the app had stopped. Idle is the app's own
         * state: no key request in flight (its "[timeline] begin/end" since this step began) and not busy, for `idle` ms
         * (5 s; `idle: none` waits as before).
         */
        const idleMs = spec.idle === 'none' ? 0 : Number(spec.idle || 5000);
        let inflight = 0;
        for (const x of seen) if (x.at >= prevStart) { const t = /^\[timeline\] \d+ (begin|end) /.exec(x.l); if (t) inflight = Math.max(0, inflight + (t[1] === 'begin' ? 1 : -1)); }
        let idleTimer = null;
        let idleReject = null;
        const idle = new Promise((_, rej) => { idleReject = rej; });
        const armIdle = () => {
          clearTimeout(idleTimer);
          if (!idleMs || inflight > 0 || (d.app.flags && d.app.flags.busy)) return;
          idleTimer = setTimeout(() => idleReject(new Error(`no log line /${spec.pattern}/ - the app went idle (no key request, not busy, ${idleMs / 1000} s) without it`)), idleMs);
        };
        const onLog = (l) => { const t = /^\[timeline\] \d+ (begin|end) /.exec(String(l)); if (t) { inflight = Math.max(0, inflight + (t[1] === 'begin' ? 1 : -1)); armIdle(); } };
        d.app.on('log', onLog);
        d.app.on('controls', armIdle);
        armIdle();
        const line = await Promise.race([
          d.until(re, { life, fail: [] }).catch((e) => { throw new Error(`no log line /${spec.pattern}/: ${e.message.split('\n')[0]}`); }),
          failed,
          idle,
        ]).finally(() => { stopFail = true; clearTimeout(idleTimer); d.app.off('log', onLog); d.app.off('controls', armIdle); });
        if (spec.as) output[spec.as] = line;
        return;
      }
      case 'machine': {
        const r = await d.machine(a.action, a.target || d.app.shell, a.args || {});
        if (!r.ok) throw new Error(`${a.action} on ${r.where}: ${r.why}`);
        if (a.as) output[a.as] = r.what;
        say(`${a.action} (${r.where}): ${String(r.what).split('\n').slice(-1)[0].slice(0, 160)}`);
        return;
      }
      default:
        throw new Error(`"${name}" is not a command this runner knows (Maestro's that fit, and ours: login, budget, goto, waitForLog, machine)`);
    }
  }

  return { runFile, output, get drive() { return d; } };
}

module.exports = { createRunner, loadFlow, forShell };

/*
 * THE DRIVE APP'S WINDOW (Brad, 2026-10-31: "i want the drive server to run in nwjs so you're forced to have a single
 * instance gui to show me on the host the drive server runs on"). NW.js runs one instance per host ("single-instance"
 * in package.json): a second launch only brings this window forward. Closing it stops the server or remote with it -
 * nothing of the drive runs where it cannot be seen (the box's bash windows duplicated themselves, 2026-10-31).
 *
 * ONE TAB PER APP (Brad: "each connected app is a tab, so logs can be separated, and the per-app picture button solves
 * itself"): the drive's own tab holds the drive's lines and every picture; each app's tab holds that app's own log and
 * its pictures, and its Picture now asks only that app. A tab stays after its app goes (its dot greys), so what it
 * said last is still there.
 *
 * The mode comes from the launch (launch.js): `server [--port N] [--remote ws://host:8791 ...]` or
 * `remote [--port N] [--control-port N]` (a remote relays apps but does not read them: its window has the drive tab
 * only). Everything shown arrives as an event from the module's bus: each line, each picture. Nothing here polls.
 */
const path = require('path');
const fs = require('fs');

const argv = nw.App.argv;
const mode = argv[0] === 'remote' ? 'remote' : 'server';
const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const many = (name) => argv.flatMap((x, i) => (x === name && argv[i + 1] ? [argv[i + 1]] : []));

/* the modules from the app's own folder (tools/drive), not the page's */
const mod = require(path.join(nw.__dirname, mode === 'remote' ? 'remote.js' : 'server.js'));

const $ = (id) => document.getElementById(id);
const MAX_LINES = 5000;
const DRIVE = 'drive';
/* every run's record (#5): a row each, newest first; a click shows its pictures, a double click opens its folder */
const RUNS_TAB = 'runs';
let follow = true;

$('mode').textContent = `drive ${mode} - ${require('os').hostname()}`;
document.title = `OnlyKey drive ${mode}`;

function classOf(l) {
  if (/FAIL|failed|refused|stalled|STOPPED|no picture|wrong token/i.test(l)) return 'fail';
  if (/PASS|passed|\bdone\b|FINISHED/i.test(l)) return 'pass';
  if (/\[press\]|press(ed)?\b/i.test(l)) return 'press';
  if (/^\S+ (run|=>|<=)/.test(l)) return 'run';
  return '';
}

/* ---------------------------------------------------------------- tabs: the drive's, then one per app */

const tabs = new Map(); /* name -> {button, dot, log, shots, lazy, seen} */
let current = DRIVE;

function tabOf(name, kind = 'app') {
  if (tabs.has(name)) return tabs.get(name);
  const button = document.createElement('button');
  const dot = document.createElement('span');
  dot.className = 'dot';
  dot.textContent = '●';
  button.append(dot, document.createTextNode(name));
  button.onclick = () => show(name);
  $('tabs').appendChild(button);
  const log = document.createElement('div');
  log.className = 'log hidden';
  $('logs').appendChild(log);
  const shots = document.createElement('div');
  shots.className = 'shots hidden';
  $('shotLists').appendChild(shots);
  /* an image is read only when it scrolls into view: a long history costs nothing until looked at */
  const lazy = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      lazy.unobserve(e.target);
      try { e.target.src = `data:image/png;base64,${fs.readFileSync(e.target.dataset.file).toString('base64')}`; } catch { e.target.alt = 'gone'; }
    }
  }, { root: shots, rootMargin: '400px' });
  const t = { button, dot, log, shots, lazy, seen: new Set(), kind };
  tabs.set(name, t);
  /* an app's tab opens with what it said before the window saw it (the server keeps its last 300 lines) */
  if (kind === 'app' && name !== DRIVE && name !== RUNS_TAB && mod.recentOf) for (const l of mod.recentOf(name)) addLine(name, l);
  /* and with its saved pictures */
  /* a saved file names only its shell: shown in each tab of that shell ("desktop (host)") */
  if (kind === 'app' && name !== DRIVE && name !== RUNS_TAB) for (const p of past) if (p.shell === name || name.startsWith(`${p.shell} (`)) addShotTo(name, p.f, false);
  if (name === current) show(name);
  return t;
}

function show(name) {
  current = name;
  for (const [n, t] of tabs) {
    t.button.classList.toggle('on', n === name);
    t.log.classList.toggle('hidden', n !== name || t.kind === 'group');
    t.shots.classList.toggle('hidden', n !== name);
    if (t.kind === 'group') for (const r of t.runs || []) r.log.classList.toggle('hidden', n !== name || r !== t.selected);
  }
  const t = tabs.get(name);
  const shown = t.kind === 'group' ? t.selected : t;
  if (follow && shown) shown.log.scrollTop = shown.log.scrollHeight;
  /* a build or a test has no screen: no picture to take there */
  $('shotNow').classList.toggle('hidden', t.kind === 'group');
  if (t.kind === 'group') { $('shotsHead').textContent = 'runs, newest first - click one for its output'; return; }
  $('shotNow').title = name === DRIVE ? 'a picture of every connected app and a sample of the log, now' : `a picture of ${name} and a sample of its log, now`;
  $('shotsHead').textContent = name === DRIVE ? 'every picture, newest first' : name === RUNS_TAB ? 'click a run: its pictures and samples' : `${name}'s pictures, newest first`;
}

/*
 * LINES DRAWN ONCE A FRAME (Brad, 2026-11-01: "the drive window is not responsive, locked up" - its renderer at full CPU,
 * 690 MB and growing, while the soft key's console and the web app's key requests logged hundreds of lines a second):
 * each line was its own append and its own scroll, a layout per line. Now lines wait in a queue per tab and one frame
 * draws them all - one append, one trim, one scroll - and a tab more than MAX_LINES behind drops the oldest unseen ones.
 */
const pending = new Map();
let frame = 0;
function addLine(name, l) {
  addLineTo(tabOf(name), l);
}
/* a sink is anything with a log: an app's tab, or one run in a group tab */
function addLineTo(t, l) {
  let q = pending.get(t);
  if (!q) { q = []; pending.set(t, q); }
  q.push(l);
  if (q.length > MAX_LINES) q.splice(0, q.length - MAX_LINES);
  if (!frame) frame = requestAnimationFrame(drawLines);
}
function drawLines() {
  frame = 0;
  for (const [t, q] of pending) {
    const batch = document.createDocumentFragment();
    for (const l of q) {
      const div = document.createElement('div');
      div.textContent = l;
      div.className = classOf(l);
      batch.appendChild(div);
    }
    t.log.appendChild(batch);
    let extra = t.log.childElementCount - MAX_LINES;
    while (extra-- > 0) t.log.firstChild.remove();
    if (follow && !t.log.classList.contains('hidden')) t.log.scrollTop = t.log.scrollHeight;
  }
  pending.clear();
}

$('follow').onclick = () => {
  follow = !follow;
  $('follow').textContent = follow ? 'following' : 'paused';
  if (follow) { const t = tabs.get(current); t.log.scrollTop = t.log.scrollHeight; }
};

/* ---------------------------------------------------------------- pictures */

function itemOf(t, file, fresh) {
  const div = document.createElement('div');
  const sample = file.endsWith('.log');
  div.className = `item${sample ? ' sample' : ''}${fresh ? ' new' : ''}`;
  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = sample ? `log sample ${path.basename(file)}` : path.basename(file);
  div.appendChild(name);
  if (sample) name.onclick = () => nw.Shell.openItem(file);
  else {
    const img = document.createElement('img');
    img.dataset.file = file;
    img.onclick = () => nw.Shell.openItem(file);
    div.appendChild(img);
    t.lazy.observe(img);
  }
  return div;
}

function addShotTo(name, file, fresh) {
  const t = tabOf(name);
  if (t.seen.has(file)) return;
  t.seen.add(file);
  t.shots.prepend(itemOf(t, file, fresh));
  if (fresh && name === current) t.shots.scrollTop = 0;
}

/* a picture goes to the drive's tab (every picture) and to its app's */
function addShot(file, shell, fresh = true) {
  addShotTo(DRIVE, file, fresh);
  if (shell) addShotTo(shell, file, fresh);
}

/* whose a saved file is, from its name: <hhmmss>-<shell>-<name>.png, or a sample ending -<shell>.log */
const SHELLS = ['desktop', 'android', 'webapp'];
function shellOfFile(n) {
  const png = /^\d{6}-([a-z]+)-/.exec(n);
  if (png && SHELLS.includes(png[1])) return png[1];
  const log = /-([a-z]+)\.log$/.exec(n);
  return log && SHELLS.includes(log[1]) ? log[1] : null;
}

function listPast() {
  if (!mod.SHOTS) { $('shotsHead').textContent = 'pictures are saved on the drive server\'s host'; return; }
  let names = [];
  try { names = fs.readdirSync(mod.SHOTS).filter((n) => /\.(png|log)$/.test(n)); } catch { return; }
  const files = names.map((n) => ({ n, f: path.join(mod.SHOTS, n) })).map((x) => ({ ...x, t: fs.statSync(x.f).mtimeMs })).sort((a, b) => a.t - b.t);
  past = files.map(({ n, f }) => ({ f, shell: shellOfFile(n) }));
  for (const { f, shell } of past) { addShotTo(DRIVE, f, false); if (shell && tabs.has(shell)) addShotTo(shell, f, false); }
}
/* the saved pictures, for an app's tab opened later (tabOf) */
let past = [];

/* Brad's button: a picture of what he sees, at the moment he sees it - of the open tab's app, or of every app */
$('shotNow').onclick = () => (mode === 'remote' ? mod.shotNow() : mod.shotNow('host', current === DRIVE || current === RUNS_TAB ? undefined : current));

/* Brad's "I see no activity": one line to Claude (server.js noActivity, wake.js "user"); the server's only */
if (mode === 'server') $('noActivity').onclick = () => mod.noActivity();
else $('noActivity').style.display = 'none';

/* ---------------------------------------------------------------- runs (#5) */

function addRun(rec, fresh = true) {
  const t = tabOf(RUNS_TAB);
  const row = document.createElement('div');
  const when = new Date(rec.started).toLocaleString();
  const secs = Math.round(rec.ms / 1000);
  const dur = secs >= 60 ? `${Math.floor(secs / 60)}m ${secs % 60}s` : `${secs}s`;
  row.textContent = `${rec.verdict === 'PASS' ? '✓' : '✗'} ${when}  ${rec.script} on ${rec.app}  ${dur}${rec.reason ? `  - ${rec.reason}` : ''}`;
  row.className = rec.verdict === 'PASS' ? 'pass' : 'fail';
  row.style.cursor = 'pointer';
  row.title = rec.dir;
  /* its pictures and samples in the picture bar; its folder on a double click */
  row.onclick = () => {
    t.shots.replaceChildren();
    t.seen.clear();
    for (const f of rec.files || []) addShotTo(RUNS_TAB, f, false);
    $('shotsHead').textContent = `${rec.script} on ${rec.app}: ${(rec.files || []).length} picture(s) and sample(s)`;
  };
  row.ondblclick = () => nw.Shell.openItem(rec.dir);
  t.log.prepend(row);
  if (fresh && current === RUNS_TAB) t.log.scrollTop = 0;
}

/* ---------------------------------------------------------------- status: the chips and the tabs' dots */

function showStatus() {
  const s = mod.status();
  const chips = [];
  if (mode === 'remote') {
    chips.push([s.server ? 'ok' : 'bad', s.server ? 'server connected' : 'no server']);
    chips.push(['', `${s.apps} app(s)`]);
  } else {
    /* a machine's USB keys (watchKeys): how many of each kind - "hard" a real OnlyKey, "gadget" the emulator's soft key */
    const keyCount = (keys) => (!keys ? '' : ` · keys: ${keys.length ? Object.entries(keys.reduce((m, k) => ({ ...m, [k.kind]: (m[k.kind] || 0) + 1 }), {})).map(([k, n]) => `${n} ${k}`).join(', ') : 'none'}`);
    for (const r of s.remotes) chips.push([r.up ? 'ok' : 'bad', `remote ${r.machine || '?'}${r.up ? '' : ' (down)'}${keyCount(r.keys)}`]);
    if (s.localKeys) chips.push(['', `this machine${keyCount(s.localKeys)}`]);
    if (!s.apps.length) chips.push(['bad', 'no app connected']);
    const up = new Set();
    for (const a of s.apps) {
      up.add(a.tab || a.shell);
      tabOf(a.tab || a.shell);
      chips.push(['ok', `${a.shell}${a.via ? ` via ${a.via}` : ''}${a.flags && a.flags.phase ? ` - ${a.flags.phase}` : ''}${a.flags && a.flags.key && a.flags.key !== 'unknown' ? ` · its key ${a.flags.key}` : ''}`]);
    }
    for (const [n, t] of tabs) if (t.kind === 'app' && n !== DRIVE && n !== RUNS_TAB) t.dot.classList.toggle('up', up.has(n));
  }
  tabs.get(DRIVE).dot.classList.add('up');
  $('chips').replaceChildren(...chips.map(([c, t]) => { const e = document.createElement('span'); e.className = `chip ${c}`; e.textContent = t; return e; }));
}

/* ---------------------------------------------------------------- events */

tabOf(DRIVE);
if (mode === 'server') { tabOf(RUNS_TAB); for (const r of mod.pastRuns()) addRun(r, false); mod.bus.on('run', (r) => addRun(r)); }
show(DRIVE);
/* a connect or disconnect always logs a drive line: the status is redrawn on each */
mod.bus.on('line', (l) => { addLine(DRIVE, l); showStatus(); });
mod.bus.on('app-line', (shell, l) => addLine(shell, l));
/*
 * COMMAND RUNS IN GROUP TABS, ONE SET PER HOST (Brad, 2026-10-31: "a build output tab and a tab style for cli commands";
 * 2026-11-02: "a tab for each test and build will be bulky, so 1 builds and 1 tests ... the bar for photos can be
 * container for each test/build instead of a photo, its a test - like a tab in tabs"; "and thats per host, so tests
 * (HOST)"): every build on a host in "builds (HOST)", every check in "tests (HOST)", every CLI run in "cli (HOST)". The
 * bar lists the runs, newest first, each with its dot - running (amber), passed (green), failed (red) - and a click
 * shows its output, a terminal's look: "$ command" first, its lines as they come, "exit N" last. A new run is shown as
 * it starts while the window follows. The last RUNS_KEPT of each stay.
 */
const RUNS_KEPT = 30;
const groupOf = (name, machine) => `${/^(build|hex)\b/.test(name) ? 'builds' : /^check\b/.test(name) ? 'tests' : 'cli'} (${machine})`;
const liveRun = new Map(); /* a command's name on a host -> its run now */
function selectRun(t, run) {
  t.selected = run;
  for (const r of t.runs) { r.item.classList.toggle('on', r === run); r.log.classList.toggle('hidden', current !== t.name || r !== run); }
  if (follow) run.log.scrollTop = run.log.scrollHeight;
}
function startRun(name, ev, machine) {
  const group = groupOf(name, machine);
  const t = tabOf(group, 'group');
  if (!t.runs) { t.runs = []; t.selected = null; t.name = group; }
  const log = document.createElement('div');
  log.className = 'log cli hidden';
  $('logs').appendChild(log);
  const item = document.createElement('div');
  item.className = 'run';
  const dot = document.createElement('span');
  dot.className = 'dot run';
  dot.textContent = '●';
  const what = document.createElement('span');
  what.className = 'what';
  what.textContent = name;
  const meta = document.createElement('div');
  meta.className = 'meta';
  const started = new Date();
  meta.textContent = `${started.toTimeString().slice(0, 8)} · running`;
  item.append(dot, what, meta);
  const run = { log, item, dot, meta, started, group };
  item.onclick = () => selectRun(t, run);
  t.shots.prepend(item);
  t.runs.unshift(run);
  while (t.runs.length > RUNS_KEPT) { const old = t.runs.pop(); old.log.remove(); old.item.remove(); }
  t.dot.className = 'dot run';
  liveRun.set(`${machine}|${name}`, run);
  if (follow || !t.selected) selectRun(t, run);
  addLineTo(run, `${started.toTimeString().slice(0, 8)} $ ${ev.cmd}`);
  return run;
}
mod.bus.on('cmd', (name, ev, machine) => {
  const key = `${machine}|${name}`;
  const run = ev.t === 'start' ? startRun(name, ev, machine) : liveRun.get(key) || startRun(name, { cmd: name }, machine);
  if (ev.t === 'line') addLineTo(run, ev.text);
  else if (ev.t === 'end') {
    const ok = ev.code === 0;
    addLineTo(run, `${new Date().toTimeString().slice(0, 8)} exit ${ev.code} ${ok ? '✓' : '✗'}`);
    run.dot.className = `dot ${ok ? 'up' : 'fail'}`;
    const secs = Math.round((Date.now() - run.started) / 1000);
    run.meta.textContent = `${run.started.toTimeString().slice(0, 8)} · ${ok ? 'passed' : 'failed'} in ${secs >= 60 ? `${Math.floor(secs / 60)}m ${secs % 60}s` : `${secs}s`}`;
    tabs.get(run.group).dot.className = `dot ${ok ? 'up' : 'fail'}`;
    liveRun.delete(key);
  }
});
mod.bus.on('shot', (file, shell) => addShot(file, shell));
mod.bus.on('sample', (file, shell) => addShot(file, shell));
listPast();

/* a second launch lands here (single instance): its arguments are ignored, the window comes forward */
nw.App.on('open', () => { const w = nw.Window.get(); w.restore(); w.focus(); addLine(DRIVE, `${new Date().toTimeString().slice(0, 8)} a second launch: this window is the one drive ${mode} on this host`); });

/*
 * A RESIZE, MEASURED (Brad, 2026-11-01: "the drive server did not like being resized, and is hiding gui elements"): the
 * window's size beside the page's, once the resize settles - a page that kept its old width shows here as a mismatch.
 */
let resized = 0;
nw.Window.get().on('resize', (w, h) => {
  clearTimeout(resized);
  resized = setTimeout(() => {
    addLine(DRIVE, `${new Date().toTimeString().slice(0, 8)} window ${w}x${h} · page ${window.innerWidth}x${window.innerHeight} · body ${document.body.scrollWidth} wide`);
  }, 300);
});

if (mode === 'remote') mod.start({ appPort: Number(opt('--port') || 8790), controlPort: Number(opt('--control-port') || 8791) });
else mod.start({ port: Number(opt('--port') || 8790), remotes: many('--remote') });
showStatus();

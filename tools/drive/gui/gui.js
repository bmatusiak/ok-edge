/*
 * THE DRIVE APP'S WINDOW (Brad, 2026-10-31: "i want the drive server to run in nwjs so you're forced to have a single
 * instance gui to show me on the host the drive server runs on"). NW.js runs one instance per host ("single-instance"
 * in package.json): a second launch only brings this window forward. Closing it stops the server or remote with it -
 * nothing of the drive runs where it cannot be seen (the box's bash windows duplicated themselves, 2026-10-31).
 *
 * The mode comes from the launch (launch.js): `server [--port N] [--remote ws://host:8791 ...]` or
 * `remote [--port N] [--control-port N]`. Everything shown arrives as an event from the module's bus: each line, each
 * picture. Nothing here polls.
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
const logEl = $('log');
const MAX_LINES = 5000;
let follow = true;

$('mode').textContent = `drive ${mode} - ${require('os').hostname()}`;
document.title = `OnlyKey drive ${mode}`;
/* Brad's button: a picture of what he sees, at the moment he sees it */
$('shotNow').onclick = () => mod.shotNow(mode === 'remote' ? undefined : 'host');
$('follow').onclick = () => { follow = !follow; $('follow').textContent = follow ? 'following' : 'paused'; if (follow) logEl.scrollTop = logEl.scrollHeight; };

function classOf(l) {
  if (/FAIL|failed|refused|stalled|no picture|wrong token/i.test(l)) return 'fail';
  if (/PASS|passed|\bdone\b/i.test(l)) return 'pass';
  if (/\[press\]|press(ed)?\b/i.test(l)) return 'press';
  if (/^\S+ (run|=>|<=)/.test(l)) return 'run';
  return '';
}

function addLine(l) {
  const div = document.createElement('div');
  div.textContent = l;
  div.className = classOf(l);
  logEl.appendChild(div);
  while (logEl.childElementCount > MAX_LINES) logEl.firstChild.remove();
  if (follow) logEl.scrollTop = logEl.scrollHeight;
  showStatus();
}

/* the status chips, redrawn on each line: a connect or disconnect always logs one */
function showStatus() {
  const s = mod.status();
  const chips = [];
  if (mode === 'remote') {
    chips.push([s.server ? 'ok' : 'bad', s.server ? 'server connected' : 'no server']);
    chips.push(['', `${s.apps} app(s)`]);
  } else {
    for (const r of s.remotes) chips.push([r.up ? 'ok' : 'bad', `remote ${r.machine || '?'}${r.up ? '' : ' (down)'}`]);
    if (!s.apps.length) chips.push(['bad', 'no app connected']);
    for (const a of s.apps) chips.push(['ok', `${a.shell}${a.via ? ` via ${a.via}` : ''}${a.flags && a.flags.phase ? ` - ${a.flags.phase}` : ''}`]);
  }
  $('chips').replaceChildren(...chips.map(([c, t]) => { const e = document.createElement('span'); e.className = `chip ${c}`; e.textContent = t; return e; }));
}

/*
 * THE PICTURES, ALL OF THEM (Brad: "side bar should be scrolling with all past pictures, so i can scroll and view
 * them"): newest on top, the ones already in the shots folder listed at open. An image is read only when it scrolls
 * into view (IntersectionObserver), so a long history costs nothing until looked at. The log samples a "Picture now"
 * keeps are in the list too; a click opens either one with the system's viewer.
 */
const shotsEl = $('shots');
const seen = new Set();
const lazy = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    const img = e.target;
    lazy.unobserve(img);
    try { img.src = `data:image/png;base64,${fs.readFileSync(img.dataset.file).toString('base64')}`; } catch { img.alt = 'gone'; }
  }
}, { root: shotsEl, rootMargin: '400px' });

function itemOf(file, fresh) {
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
    lazy.observe(img);
  }
  return div;
}

function addShot(file, fresh = true) {
  if (seen.has(file)) return;
  seen.add(file);
  shotsEl.prepend(itemOf(file, fresh));
  if (fresh) shotsEl.scrollTop = 0;
}

function listPast() {
  if (!mod.SHOTS) { $('shotsHead').textContent = 'pictures are saved on the drive server\'s host'; return; }
  let names = [];
  try { names = fs.readdirSync(mod.SHOTS).filter((n) => /\.(png|log)$/.test(n)); } catch { return; }
  const files = names.map((n) => path.join(mod.SHOTS, n)).map((f) => ({ f, t: fs.statSync(f).mtimeMs })).sort((a, b) => a.t - b.t);
  for (const { f } of files) addShot(f, false);
}

mod.bus.on('line', addLine);
mod.bus.on('shot', (file) => addShot(file));
mod.bus.on('sample', (file) => addShot(file));
listPast();

/* a second launch lands here (single instance): its arguments are ignored, the window comes forward */
nw.App.on('open', () => { const w = nw.Window.get(); w.restore(); w.focus(); addLine(`${new Date().toTimeString().slice(0, 8)} a second launch: this window is the one drive ${mode} on this host`); });

if (mode === 'remote') mod.start({ appPort: Number(opt('--port') || 8790), controlPort: Number(opt('--control-port') || 8791) });
else mod.start({ port: Number(opt('--port') || 8790), remotes: many('--remote') });
showStatus();

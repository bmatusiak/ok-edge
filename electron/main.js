'use strict';

/**
 * THE DESKTOP SHELL (PROPOSAL-one-gui.md: Brad's twist - the same web build in an Electron window,
 * with what only Node can do in this main process, reached over IPC).
 *
 * The window is a browser page and nothing more: contextIsolation on, nodeIntegration off, sandbox
 * on. The page reaches this process only through electron/preload.js, which exposes one function
 * and only for the channels listed there.
 *
 * The page: in development the Expo web server (OKEDGE_WEB_URL, `npm run desktop:dev-server` - the desktop build's platform files); otherwise the web
 * export in dist/desktop, served by THIS process as https://apps.crp.to/ (the export's paths start at
 * "/_expo/...", which a file:// load cannot resolve). Why that address: the key's CTAP tunnel - the
 * Passwords tab's derives, the vault - answers only the admitted origins (node-onlykey-lib
 * src/protocol/ctap.js RP_IDS), and on Windows an app cannot open the key's FIDO interface: it goes
 * through Windows' WebAuthn, which a page reaches with navigator.credentials only for its own origin.
 * Served from these files, never fetched: protocol.handle answers every request for that host here,
 * and any other https address goes to the network as usual.
 */
const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, ipcMain, protocol, net, session } = require('electron');
const { pathToFileURL } = require('url');

/*
 * A RELEASE OBEYS NO DEVELOPER SWITCH (Brad, 2026-10-28: "turn off test build for releases, and see what else needs to
 * be turned off for release builds"). Every OKEDGE_* variable is a developer's: OKEDGE_WEB_URL loads any page into the
 * window that holds the key bridge, OKEDGE_FLAVOR=test brings back the menu and devtools, OKEDGE_EMULATOR /
 * OKEDGE_NODE swap in other code. The packaged app (tools/release/desktop-package.js) clears them all
 * before anything reads one - here, first, so the soft key's host it starts inherits none either.
 */
if (app.isPackaged) {
  for (const k of Object.keys(process.env)) if (k.startsWith('OKEDGE_')) delete process.env[k];
}

/*
 * A STAND-IN FOR THE USER'S SERVER (the box's drive; Brad, 2026-11-01: "bucket-data-storage-container ~ desktop-app <->
 * remote-mcp ~ bucket-data-storage-container", the same for the web app and the phone): OKEDGE_STANDIN_HOST names the key's
 * site, which then resolves to this machine and is trusted with the box's dev certificate - the switches the box's test
 * Chromium gets for the web app - so the desktop and the web app sync through the same local server under the same name.
 * A developer's only: cleared above in a release.
 */
const STANDIN = process.env.OKEDGE_STANDIN_HOST || null;
if (STANDIN) {
  app.commandLine.appendSwitch('host-resolver-rules', `MAP ${STANDIN} 127.0.0.1`);
  app.on('certificate-error', (event, _wc, url, _err, _cert, callback) => {
    if (new URL(url).hostname !== STANDIN) return;
    event.preventDefault();
    callback(true);
  });
}

/*
 * THE TEST BUILD (OKEDGE_FLAVOR=test, electron/start.js): the development export in dist/desktop-test, the phone's debug
 * build - and its OWN page storage (a separate profile), so a test run never reads or writes what the prod build kept.
 * The origin stays https://apps.crp.to, so WebAuthn works the same.
 */
const TEST = process.env.OKEDGE_FLAVOR === 'test';
const WEB_ROOT = path.join(__dirname, '..', 'dist', TEST ? 'desktop-test' : 'desktop');
if (TEST) app.setPath('userData', `${app.getPath('userData')}-test`);

/*
 * THE PAGE RUNS AT THE KEY'S SITE (Brad, 2026-10-30: the firmware says where the server is - "we use the default rpid in
 * the firmware to ask what the rpid is, then we use that"; PROPOSAL-rectify-ok-edge.md R2). The key's own site (its
 * ctap_bridge site) is where its sync lives, and the bucket key is derived under it - over Windows' WebAuthn, which lets
 * a page use only its own origin as the rpId. Served as https://apps.crp.to the page could not derive under the key's
 * site ("the browser will not assert rpId ok-edge.bmatusiak.workers.dev from this page"), so the desktop never joined
 * its server. So the page, after its identity check, tells this process the key's site (okedge:keySite); it is kept in
 * key-site.json and the window opens there - this process answers that host from dist/desktop as it answers apps.crp.to,
 * and every path that is not one of those files goes to the real server (its room's /ws, /mcp). Until a key has named
 * its site: apps.crp.to, as before.
 */
const SITE_FILE = path.join(app.getPath('userData'), 'key-site.json');
const isHost = (s) => typeof s === 'string' && /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(s) && s.length < 254;
function readKeySite() {
  try {
    const s = JSON.parse(fs.readFileSync(SITE_FILE, 'utf8')).site;
    return isHost(s) ? s.toLowerCase() : null;
  } catch {
    return null;
  }
}
let keySite = readKeySite();
const pageUrl = () => `https://${keySite || 'apps.crp.to'}/index.html`;
ipcMain.handle('okedge:keySite', (e, site) => {
  if (site !== null && !isHost(site)) return false;
  const next = site ? site.toLowerCase() : null;
  if (next === keySite) return false;
  keySite = next;
  try { fs.writeFileSync(SITE_FILE, JSON.stringify({ site: keySite })); } catch (err) { console.error(`[site] not kept: ${err.message}`); }
  console.log(`[site] the key's site is ${keySite || 'none'} - the page opens at ${pageUrl()}`);
  /* a development page (OKEDGE_WEB_URL) stays where it is: its server is the developer's */
  if (!process.env.OKEDGE_WEB_URL) setImmediate(() => e.sender.loadURL(pageUrl()));
  return true;
});


/*
 * THE APP'S PICTURE OF ITSELF, for a drive (PROPOSAL-drive.md; Brad, 2026-10-31: "asking the app for the screenshot,
 * not host dependent - have the app do it"): this window's own page as a PNG, base64. Only a debug or TEST build's
 * page asks (src/drive/shot.desktop.ts, behind the drive's debugging gate).
 */
ipcMain.handle('okedge:shot', async (e) => (await e.sender.capturePage()).toPNG().toString('base64'));
/* the app closes itself for a drive's stop or restart - as a window close would, storage flushed (src/drive/quit.desktop.ts) */
ipcMain.handle('okedge:quit', () => { setImmediate(() => app.quit()); return true; });

/* one channel per thing the page may ask for; preload.js lists the same names */
ipcMain.handle('okedge:about', () => ({
  electron: process.versions.electron,
  node: process.versions.node,
  chrome: process.versions.chrome,
  platform: `${process.platform}-${process.arch}`,
}));

/* the phone's native modules, the desktop's half (electron/desktop; the page's half: src/desktop/specs) */
const desktopModules = require('./desktop');
for (const [channel, fn] of Object.entries(desktopModules.handlers)) {
  ipcMain.handle(channel, (_event, ...args) => fn(...args));
}
/* a spec's synchronous methods: answered in place (a throw answers null rather than hanging the page) */
for (const [channel, fn] of Object.entries(desktopModules.syncHandlers)) {
  ipcMain.on(channel, (event, ...args) => {
    try { event.returnValue = fn(...args); } catch { event.returnValue = null; }
  });
}
/* their events, pushed to every window (the page subscribes through the preload's on()) */
desktopModules.attach((channel, payload) => {
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send(channel, payload);
});

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 760,
    title: 'ok-edge',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  const dev = process.env.OKEDGE_WEB_URL;
  /*
   * NO MENU BAR IN PRODUCTION (Brad, 2026-10-25: "can we remove that menu bar in production release, but keep it in
   * other builds like debug or test"): Electron's File / Edit / View / Window - reload, devtools - stays for the
   * debug page (OKEDGE_WEB_URL) and the test build; the production window has none.
   */
  if (!dev && !TEST) win.removeMenu();
  if (dev) win.loadURL(dev);
  else win.loadURL(pageUrl());
  /*
   * No driving hooks here: the app is driven, read and pictured through the drive (src/drive, tools/drive) - the
   * timed OKEDGE_SHOT, the injected OKEDGE_DRIVE walk, OKEDGE_CONSOLE and the DevTools port are gone (2026-10-31,
   * Brad: remove the code that drove before, "so the new drive system is used instead of forgotten").
   */
}

/*
 * ONE INSTANCE. A second ok-edge would start a second soft key on the same flash.bin - two
 * firmwares writing one flash is data loss (ok-rn's manifest says the same of a second process).
 * A second start brings the open window forward and quits.
 */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });
}

app.whenReady().then(() => {
  protocol.handle('https', (request) => {
    const url = new URL(request.url);
    const site = keySite && url.hostname === keySite && keySite !== 'apps.crp.to';
    if (url.hostname !== 'apps.crp.to' && !site) return net.fetch(request, { bypassCustomProtocolHandlers: true });
    /* inside dist/desktop only, whatever the path says */
    const file = path.normalize(path.join(WEB_ROOT, decodeURIComponent(url.pathname)));
    const isFile = file.startsWith(WEB_ROOT) && fs.existsSync(file) && !fs.statSync(file).isDirectory();
    if (isFile) return net.fetch(pathToFileURL(file).toString());
    /* the key's site is a real server too: what is not this app's page goes to it (/ws, /mcp, its version.json) */
    if (site && url.pathname !== '/') return net.fetch(request, { bypassCustomProtocolHandlers: true });
    return net.fetch(pathToFileURL(path.join(WEB_ROOT, 'index.html')).toString());
  });
  createWindow();
  /* the CLI's way in (electron/desktop/hosting.js): onlykey-js reaches the key through this app while it runs */
  desktopModules.start().catch((e) => console.error(`[desktop] ${e.message}`));
});

/*
 * THE PAGE'S STORAGE IS WRITTEN OUT WHEN THE WINDOW CLOSES (box, 2026-10-24: on Linux the app can hang after
 * quitting and be stopped by force - and what the page had just stored, the identity's sealed bucket, the agent
 * identity, never reached the disk). Flushed here, before anything that can hang.
 */
const flushStorage = () => { try { session.defaultSession.flushStorageData(); } catch (e) { console.error(`[storage] flush: ${e.message}`); } };
app.on('window-all-closed', () => {
  flushStorage();
  app.quit();
});
/*
 * AND ON EVERY OTHER WAY OUT (2026-11-02, Windows: the server set in the Server panel was gone after each restart): app.quit()
 * - the drive's quit, a menu's Quit - does not emit window-all-closed, so nothing was flushed before the processes ended.
 * before-quit comes first on every path.
 */
/*
 * ...AND THE QUIT WAITS FOR IT (2026-11-03, Windows: the Server setting written half an hour before was gone after a quit
 * that took a second, and kept after every quit that hung - Chromium batches and rate-limits its page-storage writes, and
 * flushStorageData() only starts the write; the process left before it landed). The flush gives no event when it is done,
 * so the quit is held QUIT_FLUSH_MS after it - the one wait here that has nothing to wait on - then goes on, once.
 */
const QUIT_FLUSH_MS = 1500;
let quitFlushed = false;
app.on('before-quit', (e) => {
  if (quitFlushed) return;
  quitFlushed = true;
  flushStorage();
  e.preventDefault();
  setTimeout(() => app.quit(), QUIT_FLUSH_MS);
});
/*
 * desktop.json leaves with the app, so the CLI goes back to the key directly - and THEN THE MASTER EXITS (Brad, 2026-11-03:
 * "electron has a master and gui process ... the close 20 s issue is only closing the gui side"): the window's process
 * went at once, the master stayed - its own clean-up (the CLI's pipe, the member, the local MCP) started and never waited
 * for - until a drive ended it 20 s later. Now the clean-up is waited for (STOP_MS at most) and the master exits.
 */
const STOP_MS = 3000;
let stopping = false;
app.on('will-quit', (e) => {
  if (stopping) return;
  stopping = true;
  e.preventDefault();
  Promise.race([desktopModules.stop().catch(() => {}), new Promise((ok) => setTimeout(ok, STOP_MS))])
    .finally(() => app.exit(0));
});

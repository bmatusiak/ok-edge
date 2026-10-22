'use strict';

/**
 * THE DESKTOP SHELL (PROPOSAL-one-gui.md: Brad's twist - the same web build in an Electron window,
 * with what only Node can do in this main process, reached over IPC).
 *
 * The window is a browser page and nothing more: contextIsolation on, nodeIntegration off, sandbox
 * on. The page reaches this process only through electron/preload.js, which exposes one function
 * and only for the channels listed there.
 *
 * The page: in development the Expo web server (OKEDGE_WEB_URL, `npm run web`); otherwise the web
 * export in dist/web, served under okedge://app/ - the export's paths start at "/_expo/...", which
 * a file:// load cannot resolve and an app scheme can.
 */
const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, ipcMain, protocol, net } = require('electron');
const { pathToFileURL } = require('url');

const WEB_ROOT = path.join(__dirname, '..', 'dist', 'web');

protocol.registerSchemesAsPrivileged([{ scheme: 'okedge', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

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
  if (dev) win.loadURL(dev);
  else win.loadURL('okedge://app/index.html');
  /*
   * OKEDGE_SHOT=<file.png>: a picture of THIS window once the page has rendered, then quit - how a
   * test or a check looks at the desktop shell without capturing the person's whole screen.
   */
  const shot = process.env.OKEDGE_SHOT;
  if (shot) {
    win.webContents.once('did-finish-load', () => setTimeout(async () => {
      fs.writeFileSync(shot, (await win.webContents.capturePage()).toPNG());
      app.quit();
    }, Number(process.env.OKEDGE_SHOT_MS || 3000)));
  }
  /*
   * OKEDGE_DRIVE=<file>: a script run in the page once it has loaded - how tools/e2e-desktop.js
   * walks the app to its test runner (tools/e2e-desktop-drive.js), as tools/e2e.js taps through
   * adb on the phone. Only on a development page (OKEDGE_WEB_URL): a packaged app never runs one.
   */
  const drive = process.env.OKEDGE_DRIVE;
  if (drive && dev) {
    /* every load: a development page reloads (Fast Refresh, Metro after a change) and loses it */
    win.webContents.on('did-finish-load', () => {
      win.webContents.executeJavaScript(fs.readFileSync(drive, 'utf8')).catch((e) => console.error(`[drive] ${e.message}`));
    });
  }
  /* OKEDGE_CONSOLE=1: the page's console on this process's stdout - how a check reads what the page said */
  if (process.env.OKEDGE_CONSOLE === '1') {
    win.webContents.on('console-message', (e) => console.log(`[page ${e.level}] ${e.message}`));
  }
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
  protocol.handle('okedge', (request) => {
    const url = new URL(request.url);
    /* inside dist/web only, whatever the path says */
    const file = path.normalize(path.join(WEB_ROOT, decodeURIComponent(url.pathname)));
    if (!file.startsWith(WEB_ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      return net.fetch(pathToFileURL(path.join(WEB_ROOT, 'index.html')).toString());
    }
    return net.fetch(pathToFileURL(file).toString());
  });
  createWindow();
});

app.on('window-all-closed', () => app.quit());

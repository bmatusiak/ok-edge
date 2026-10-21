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
    }, 3000));
  }
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

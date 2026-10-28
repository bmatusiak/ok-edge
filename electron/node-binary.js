'use strict';
/*
 * THE PLAIN NODE THE DESKTOP APP'S CHILDREN RUN ON - the soft key's host (desktop/okemu.js: the firmware's flash must sit
 * below 4 GB, which Chromium's own reservation takes in an Electron process) and the lib's CLI for the sync service
 * (desktop/sync.js: the Bluetooth stack is a native module built for Node).
 *
 *   OKEDGE_NODE         a developer's override
 *   the packaged app    the Node it carries, <resources>/node (tools/release/desktop-package.js puts it there) - a
 *                       computer the app is installed on need not have Node at all, and the soft key's native module
 *                       is built for exactly that Node's ABI
 *   a checkout          `node` on the PATH, as it always ran
 */
const path = require('path');
const { app } = require('electron');

module.exports = function nodeBinary() {
  if (process.env.OKEDGE_NODE) return process.env.OKEDGE_NODE;
  if (app.isPackaged) return path.join(process.resourcesPath, 'node', process.platform === 'win32' ? 'node.exe' : 'node');
  return 'node';
};

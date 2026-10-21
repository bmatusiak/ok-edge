'use strict';

/**
 * Start the desktop shell as Electron, whoever started us. VS Code (itself Electron) passes
 * ELECTRON_RUN_AS_NODE=1 to every process it starts, and with it set the electron binary runs our
 * main.js as plain Node - no window, a crash on require('electron'). Dropped here, for this child
 * only. Required from Node, the electron package is the path to its binary.
 */
const path = require('path');
const { spawn } = require('child_process');
const electron = require('electron');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
spawn(electron, [path.join(__dirname, 'main.js'), ...process.argv.slice(2)], { stdio: 'inherit', env })
  .on('exit', (code) => process.exit(code ?? 0));

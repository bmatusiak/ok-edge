'use strict';
/*
 * A PRESS BY HAND, ON THE BOX (Brad, 2026-11-01: "i just need something really simple, just so i can send a key press
 * and something you can open for me, and i can close"; "a simple nodejs script on the box with the gadget"): a window on
 * the box's screen with two buttons - Send press, Close. Send press is one press (button 1) on the web app's key,
 * through the drive-remote here, which holds the gadget's one controller socket (tools/drive/remote.js /press). Close
 * closes the window only - the key, the app and the drive go on, and it can be opened again whenever wanted.
 *
 *   node tools/box/press-window.js [--app webapp]
 *
 * zenity, as the lib's --gui-prompt on Linux: started with an argument list, no shell.
 */
const { execFile } = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const i = process.argv.indexOf('--app');
const app = i >= 0 ? process.argv[i + 1] : 'webapp';
const token = (process.env.DRIVE_TOKEN || (() => { try { return fs.readFileSync(path.join(os.homedir(), '.onlykey-drive-token'), 'utf8'); } catch { return ''; } })()).trim();
if (!token) { console.error('press-window: no drive token (~/.onlykey-drive-token)'); process.exit(1); }

const press = () => new Promise((resolve) => {
  const q = new URLSearchParams({ token, app });
  http.get({ host: '127.0.0.1', port: 8791, path: `/press?${q}`, timeout: 20000 }, (res) => {
    let body = '';
    res.on('data', (c) => { body += c; });
    res.on('end', () => resolve(body || `HTTP ${res.statusCode}`));
  }).on('error', (e) => resolve(`no drive-remote here: ${e.message}`)).on('timeout', function () { this.destroy(new Error('timed out')); });
});

/* one window per press: its text says how the last one went */
function ask(said) {
  const text = `One press (button 1) on the key of ${app}.\nClosing this window leaves the key alone.${said ? `\n\nLast: ${said}` : ''}`;
  execFile('zenity', ['--question', '--no-markup', '--title', `Press by hand - ${app}`, '--text', text, '--ok-label', 'Send press', '--cancel-label', 'Close', '--width', '380'], async (err) => {
    if (err) { console.log('press window closed'); return; }
    const r = await press();
    console.log(`press: ${r}`);
    ask(r);
  });
}
console.log(`press window open for ${app} on ${process.env.DISPLAY || 'the screen'} - Send press presses its key, Close closes only the window`);
ask('');

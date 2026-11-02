'use strict';

/**
 * THIS APP IS THE COMPUTER'S MEMBER WHILE IT IS OPEN (the structure track S5b; Brad, 2026-11-02: the desktop app and
 * `onlykey-js --service` are one device - "if the --service is taken over from the desktop, it shows up as 1 device?
 * right?"). node-onlykey-lib desktop/member.js decides which process serves this computer, on one endpoint the
 * operating system gives to one process at a time: this app asks first (priority 'desktop'), so a service that served
 * lets go of its key, its room and the local MCP's port, and stands by until this app ends - a crash included.
 *
 * What serving means here: the local MCP (localMcp.js) runs. The room is the page's (src/serverRoom.ts), joined with the
 * computer's one id (okedge:roomDevice, hosting.js); a service that still sat in the room is replaced there (4409).
 */
const localMcp = require('./localMcp');

let member = null;

async function start() {
  const { createMember } = require('node-onlykey-lib/desktop/member');
  member = createMember({
    who: 'the desktop app',
    priority: 'desktop',
    log: (l) => console.log(`[member] ${l}`),
    onServe: () => localMcp.serve(),
    onStandBy: () => localMcp.stop(),
  });
  await member.start();
}

async function stop() {
  const m = member;
  member = null;
  if (m) await m.stop();
}

module.exports = { start, stop };

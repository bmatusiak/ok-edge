'use strict';
/*
 * IS ANYONE LISTENING (Brad, 2026-11-01: "when you start wake monitor, can you have drive doctor tell you if you're
 * connected to it or not ... so you can run doctor and it will tell/recommend that you should watch it"; that morning
 * his "I see no activity" press reached a log nobody followed). wake.js only follows the drive's log file, so nothing
 * else knows it runs: it leaves this mark while it does - its pid, the kinds it wakes on, since when - beside that log,
 * and takes it away when it ends. A mark whose pid is gone (a watcher killed outright) reads as none.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const MARK = path.join(path.dirname(process.env.DRIVE_LOG || path.join(os.homedir(), 'drive-logs', 'drive-server.log')), 'wake.json');

/** the watcher running now, or null */
function wakeWatcher() {
  let m;
  try { m = JSON.parse(fs.readFileSync(MARK, 'utf8')); } catch { return null; }
  try { process.kill(m.pid, 0); } catch (e) { if (!e || e.code !== 'EPERM') return null; }
  return m;
}

/** this process is the watcher: the mark set, and taken away when it ends */
function markWatching(on) {
  fs.mkdirSync(path.dirname(MARK), { recursive: true });
  fs.writeFileSync(MARK, JSON.stringify({ pid: process.pid, on, since: new Date().toISOString() }));
  const clear = () => {
    try { if (JSON.parse(fs.readFileSync(MARK, 'utf8')).pid === process.pid) fs.unlinkSync(MARK); } catch { /* gone already */ }
  };
  process.on('exit', clear);
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { clear(); process.exit(0); });
}

/** what to tell the agent when nobody watches */
const ARM = 'MONITOR: node tools/drive/wake.js (persistent, re-arm at each expiry) - Brad\'s "I see no activity" and pictures wake nobody without it';

module.exports = { wakeWatcher, markWatching, ARM, MARK };

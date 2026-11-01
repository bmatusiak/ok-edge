'use strict';
/*
 * THE STATE OF EVERYTHING (Brad, 2026-10-31: "do you have a status or doctor command that tells you the state of
 * everything, like what repos are on the remote, what heads they are on, if they are dirty (and what files are dirty),
 * devices, app pids"). Every machine at once - this one and each connected drive-remote (targets.js doctor): each
 * repo's branch and head, flagged when it is not the head this machine (Windows, the git home) has; the dirty files by
 * name; the lib ok-edge runs; the keys on its USB; its apps by pid; the phone's app. Read-only.
 *   run.js doctor [--all-files]      (a repo's dirty files: the first 8, or all)
 */
module.exports = async (d, args) => {
  const allFiles = args.includes('--all-files');
  const answers = await d.everywhere('doctor');
  const ok = answers.filter((a) => a.ok).map((a) => ({ where: a.where, ...JSON.parse(a.what) }));
  for (const a of answers.filter((x) => !x.ok)) d.say(`${a.where}: no answer - ${a.why}`);
  /* the git home's heads, to tell a clone that is behind (or ahead) */
  const home = ok.find((m) => m.platform === 'win32') || ok[0];
  const homeHead = new Map((home ? home.repos : []).map((r) => [r.name, r.head]));
  for (const m of ok) {
    d.say(`== ${m.machine} (${m.where}, ${m.platform})`);
    for (const r of m.repos) {
      const same = homeHead.get(r.name);
      const vs = m === home || !same ? '' : r.head === same ? ' = Windows' : ` ≠ Windows ${same.slice(0, 7)}`;
      d.say(`  ${r.name.padEnd(22)} ${String(r.branch || '(detached)').padEnd(16)} ${String(r.head || '?').slice(0, 7)}${vs}  ${r.dirty.length ? `DIRTY ${r.dirty.length}` : 'clean'}  ${r.subject}`);
      for (const f of allFiles ? r.dirty : r.dirty.slice(0, 8)) d.say(`      ${f}`);
      if (!allFiles && r.dirty.length > 8) d.say(`      … ${r.dirty.length - 8} more (--all-files)`);
    }
    d.say(`  lib in ok-edge/node_modules: ${m.libPin || 'none'}`);
    const keys = m.keys === null ? 'not watched on this OS' : !m.keys.length ? 'none' : m.keys.map((k) => `${k.kind} (usb ${k.usb})`).join(', ');
    d.say(`  keys on USB: ${keys}`);
    d.say(`  apps: ${Object.entries(m.apps).map(([n, pids]) => `${n} ${pids.length ? pids.join(' ') : '-'}`).join(' · ')}`);
    if (m.phone) d.say(`  phone ${m.phone.device}: ${m.phone.app} ${m.phone.pid ? `pid ${m.phone.pid}` : 'not running'}`);
  }
};

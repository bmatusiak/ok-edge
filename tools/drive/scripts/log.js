'use strict';
/*
 * THE APP'S RECENT LOG, FILTERED - event hunting through the drive server (Brad, 2026-10-31: "now that we have drive
 * server, event hunting can be simpler"). The server keeps every line each app logs (its last 300, not only during a
 * run), so "did that line come, and what came before it" is one bounded answer - no tailing, no monitor:
 *   run.js log [regex] [--last N]      the last N matching lines (default 40)
 * The lines are the caller's answer (d.answer), not said to the drive windows (2026-11-01: --last 3000 / 6000 dumps,
 * said line by line, flooded the box's drive-remote window); the windows get the one count line.
 */
const MAX = 300;
module.exports = async (d, args) => {
  const i = args.indexOf('--last');
  const last = Math.min(MAX, i >= 0 ? Number(args[i + 1]) || 40 : 40);
  const rest = args.filter((a, k) => k !== i && k !== i + 1);
  const re = rest[0] ? new RegExp(rest[0], 'i') : null;
  const hits = d.app.recent.filter((l) => !re || re.test(l));
  d.say(`${hits.length} of ${d.app.recent.length} kept lines${re ? ` match /${rest[0]}/` : ''} - the last ${Math.min(last, hits.length)}:`);
  for (const l of hits.slice(-last)) d.answer(`  ${l.slice(0, 300)}`);
};

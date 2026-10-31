'use strict';
/*
 * HUNT AN EVENT - what the app logs after a move, until the line being looked for (Brad, 2026-10-31: "now that we
 * have drive server, event hunting can be simpler"). Listens first, then taps, so nothing the taps set off is missed;
 * ends on its own - on the line, or on its watchdog - and prints at most 200 lines, so a hunt never floods anyone:
 *   run.js hunt <until regex> [--tap <label>]... [--show <regex>] [--life <s>]
 *     --tap    a control to tap, in order, once listening (none: just wait for the line)
 *     --show   only the lines matching it are printed (default: every line)
 *     --life   the watchdog in seconds (default 60) - its end says it, with the last lines seen
 * Presses are the session presser's, as in every run (testnet only).
 */
const MAX = 200;

module.exports = async (d, args) => {
  const until = args[0] && !args[0].startsWith('--') ? new RegExp(args[0], 'i') : null;
  if (!until) throw new Error('hunt <until regex> [--tap <label>]... [--show <regex>] [--life <s>]');
  const taps = [];
  let show = null;
  let life = 60;
  for (let k = 1; k < args.length; k++) {
    if (args[k] === '--tap') taps.push(args[++k]);
    else if (args[k] === '--show') show = new RegExp(args[++k], 'i');
    else if (args[k] === '--life') life = Number(args[++k]) || 60;
  }

  let printed = 0;
  const tail = [];
  const found = new Promise((resolve) => {
    const dog = setTimeout(() => { d.app.off('log', on); resolve(null); }, life * 1000);
    function on(l) {
      tail.push(l); if (tail.length > 8) tail.shift();
      if ((!show || show.test(l) || until.test(l)) && printed < MAX) { d.say(`  ${l.slice(0, 300)}`); if (++printed === MAX) d.say(`  (${MAX} lines printed - the rest only counted)`); }
      if (until.test(l)) { clearTimeout(dog); d.app.off('log', on); resolve(l); }
    }
    d.app.on('log', on);
  });
  d.say(`listening for /${args[0]}/ (watchdog ${life} s)${taps.length ? ` - then ${taps.map((t) => `"${t}"`).join(', ')}` : ''}`);
  for (const t of taps) await d.tap(t);
  const hit = await found;
  if (hit) { d.say(`found: ${hit.slice(0, 300)}`); return; }
  throw new Error(`no /${args[0]}/ in ${life} s - the last lines:\n${tail.map((l) => `    ${l.slice(0, 200)}`).join('\n')}`);
};

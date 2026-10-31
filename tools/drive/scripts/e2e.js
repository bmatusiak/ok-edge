'use strict';
/*
 * THE IN-APP E2E SUITES, THROUGH THE DRIVE - replacing tools/e2e-desktop.js and the walk Electron injected into the
 * page (OKEDGE_DRIVE), removed 2026-10-31 (Brad: remove the code that drove before, "so the new drive system is used
 * instead of forgotten"). The same on every shell the drive reaches:
 *   run.js e2e [--app desktop|android|webapp]
 * Testing mode, the Testing tab, RUN TESTS - listening first, so no line of the run is missed - then every [Moniker]
 * line as it comes, ending on its own: TEST COMPLETE (the verdict, PASS or FAIL with the counts), 90 s without a line
 * (stuck, with the last line), or the soft key's process ending (no suite can finish then).
 * One suite (the old --only) is the app's __e2e_tests__/only.js, read when the bundle is built.
 */
const { testingMode } = require('../flows');

const STALL_S = 90;

module.exports = async (d) => {
  d = await d.up();
  await testingMode(d);
  await d.goto('Testing');

  const lines = [];
  let last = '';
  const done = new Promise((resolve, reject) => {
    let dog = null;
    const quiet = () => { clearTimeout(dog); dog = setTimeout(() => end(new Error(`stuck: no line for ${STALL_S} s after: ${last}`)), STALL_S * 1000); };
    function end(err) { clearTimeout(dog); d.app.off('log', on); if (err) reject(err); else resolve(); }
    function on(l) {
      if (/\[okemu\] the soft key's process ended/.test(l)) { end(new Error(`the soft key's process died: ${l}`)); return; }
      if (!/\[Moniker\]/.test(l)) return;
      const shown = l.replace(/.*\[Moniker\]\s?/, '');
      lines.push(shown);
      last = shown;
      d.say(`  ${shown.slice(0, 200)}`);
      quiet();
      if (/TEST COMPLETE/.test(shown)) end();
    }
    d.app.on('log', on);
    quiet();
  });
  await d.tap('RUN TESTS');
  await done;

  const v = /Passed:\s*(\d+)\s*Failed:\s*(\d+)(?:\s*Skipped:\s*(\d+))?(?:\s*Bailed:\s*(\S+))?/.exec(lines.join('\n'));
  if (!v) throw new Error('the suite finished but printed no verdict');
  const [passed, failed, skipped] = [Number(v[1]), Number(v[2]), Number(v[3] || 0)];
  const verdict = `${failed === 0 ? 'PASS' : 'FAIL'}  passed=${passed} failed=${failed}${skipped ? ` skipped=${skipped}` : ''}${v[4] ? ` (bailed after ${v[4]})` : ''}`;
  d.say(verdict);
  if (failed) throw new Error(verdict);
};

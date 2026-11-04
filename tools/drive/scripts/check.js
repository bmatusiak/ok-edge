'use strict';
/*
 * THE CHECKS ON AN APP'S MACHINE, WATCHED (Brad, 2026-11-02: "for drive server/remote you can run building and testing
 * through that, so i can watch and see build and test output"): each runs in its own tab of that machine's drive
 * window, live, and its verdict comes back here.
 *   run.js check lib [--app desktop@box]                 the lib's whole suite
 *   run.js check lib bucket/test/roomsync.test.js ...    only those test files
 *   run.js check tsc                                     ok-edge's type check
 *   run.js check server                                  ok-edge's server tests, against the lib's local server
 *   run.js check kit <okt run args> [--repeat N] [--no-build]   the test kit on a soft key built as the release gate
 *                                                        builds it (targets.js kit), e.g. check kit --app desktop@box --
 *                                                        test/08-plugins/01-softkey-plugins.test.js --test "idle lockout"
 * --app names the machine (the one its target runs on). Builds are run.js rebuild --app <shell>.
 */
module.exports = async (d, args) => {
  if (!args.length) throw new Error('check <lib [test files...] | tsc | server | kit <okt run args>> [--app <shell>@<machine>]');
  const r = await d.machine('check', d.app.shell, { argv: args });
  if (!r.ok) throw new Error(`check ${args[0]} (${r.where}): ${r.why}`);
  d.say(`check ${args[0]} on ${r.where}: ${r.what}`);
};

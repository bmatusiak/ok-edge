'use strict';
/*
 * THE LIB'S CLI ON AN APP'S MACHINE (onlykey-js - for a hard key the CLI is the app), its output live in its own tab in
 * the drive window ("cli <args>"), its end here:   run.js cli --app desktop -- edge status --test-mode
 * --app names the machine (the one its target runs on). The CLI's own rules hold: no input, so a question is a "no".
 */
module.exports = async (d, args) => {
  if (!args.length) throw new Error('cli: give the CLI\'s arguments after "--" (run.js cli --app desktop -- edge status --test-mode)');
  const r = await d.machine('cli', d.app.shell, { argv: args });
  if (!r.ok) throw new Error(`cli (${r.where}): ${r.why}`);
  d.say(`done on ${r.where}:`);
  for (const l of String(r.what).split('\n')) d.say(`  ${l}`);
};

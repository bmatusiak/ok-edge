'use strict';
/*
 * FLASH A HARD KEY from the box (targets.js flashKey): the key must be waiting in its bootloader (HalfKay - the drive says
 * when one is; never OKFWUPDATE). The hex is the one run.js hex gives for that flavor - built first when there is none.
 * A developer flash wipes the key: a live key is restored after it, by its owner.
 *   run.js flash test|prod      test = DEBUG on (a test key ONLY - never live credentials), prod = DEBUG off (a live key)
 */
module.exports = async (d, args) => {
  const flavor = args.find((a) => !a.startsWith('--'));
  if (!['test', 'prod'].includes(flavor)) throw new Error('run.js flash test|prod - say which; there is no default');
  d.say(`flashing the ${flavor} hex onto the key in the box's bootloader`);
  const r = await d.machine('flash', 'firmware', { flavor });
  if (!r.ok) throw new Error(`flash ${flavor} (${r.where}): ${r.why}`);
  const h = JSON.parse(r.what);
  d.say(`flashed ${flavor}: ${h.file} sha256 ${h.sha256} (emulator ${h.commit})`);
};

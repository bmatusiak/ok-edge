'use strict';
/*
 * THE HARD KEY'S HEX (Brad, 2026-10-31: "the drive remote should be able to build both prod and test hex ... you can just
 * ask the drive server to get the last one it built or build it"): the box's firmware target (targets.js hexFor) hands
 * back the image for the emulator commit it holds, building it when there is none.
 *   run.js hex test|prod|both [--build]     test = DEBUG on (a test key), prod = DEBUG off (a live key); --build: again
 */
module.exports = async (d, args) => {
  const which = args.find((a) => !a.startsWith('--'));
  const flavors = which === 'both' ? ['test', 'prod'] : [which];
  if (!['test', 'prod'].includes(flavors[0])) throw new Error('run.js hex test|prod|both [--build]');
  for (const flavor of flavors) {
    d.say(`${flavor} hex: asking the box (it builds when it has none for this commit)`);
    const r = await d.machine('hex', 'firmware', { flavor, force: args.includes('--build') });
    if (!r.ok) throw new Error(`${flavor} hex (${r.where}): ${r.why}`);
    const h = JSON.parse(r.what);
    d.say(`${flavor}: ${h.built ? 'built' : 'the last one built'} for emulator ${h.commit} - ${h.file} sha256 ${h.sha256} (${h.at})`);
  }
};

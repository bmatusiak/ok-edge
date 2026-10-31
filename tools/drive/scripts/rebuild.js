'use strict';
/*
 * REBUILD AN APP (Brad, 2026-10-31: "when re-building for a app, close the app, and open it after build is complete"):
 * the app asked to close and its processes ended (the drive's stop), its build on its machine (targets.js build), and
 * only when that is done, the app started and back. A failed build leaves the app closed and says why - an old build
 * opened over a failed one would look like the new one.   run.js rebuild --app desktop|webapp|android
 */
module.exports = async (d) => {
  const shell = d.app.shell;
  await d.stop(shell);
  d.say(`building ${shell} on its machine (the app is closed)`);
  const r = await d.machine('build', shell);
  if (!r.ok) throw new Error(`${shell}: ${r.why} - the app stays closed (logs/build-${shell}.log on ${r.where})`);
  d.say(`${r.what} (${r.where})`);
  d = await d.start(shell);
  d.say(`${shell} is open on the new build`);
};

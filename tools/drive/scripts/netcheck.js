'use strict';
/*
 * THE PROOF OF THE NETWORK TRACE (drive debugging #4): the app fetches the drive server's own address; its "[net]"
 * line must come back. Ends on that line, or on its watchdog.   run.js netcheck [--app <shell>]
 */
module.exports = async (d) => {
  d = await d.up();
  const heard = new Promise((resolve, reject) => {
    const dog = setTimeout(() => { d.app.off('log', on); reject(new Error('no [net] line in 15 s - the app did not trace its own fetch')); }, 15000);
    function on(l) { if (/^\[net\] /.test(l)) { clearTimeout(dog); d.app.off('log', on); resolve(l); } }
    d.app.on('log', on);
  });
  const r = await d.app.call({ t: 'net-check' });
  if (!r.ok) throw new Error(`net-check: ${r.why}`);
  d.say(`heard: ${await heard}`);
};

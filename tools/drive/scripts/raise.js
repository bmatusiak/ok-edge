'use strict';
/*
 * THE PROOF THAT ERRORS ARE EVENTS (drive debugging #2): the app rejects a promise nothing handles; the drive must hear
 * it as an error and picture it, by itself. Ends on that event, or on its watchdog.   run.js raise [--app <shell>]
 */
module.exports = async (d) => {
  d = await d.up();
  const heard = new Promise((resolve, reject) => {
    const dog = setTimeout(() => { d.app.off('error-event', on); reject(new Error('no error event in 20 s - the app did not report its unhandled rejection')); }, 20000);
    function on(m) { clearTimeout(dog); d.app.off('error-event', on); resolve(m); }
    d.app.on('error-event', on);
  });
  const r = await d.app.call({ t: 'raise' });
  if (!r.ok) throw new Error(`raise: ${r.why}`);
  const m = await heard;
  d.say(`heard: ${m.kind} - ${String(m.message).split('\n')[0]}`);
};

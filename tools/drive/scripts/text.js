'use strict';
/*
 * THE APP'S SCREEN TEXT, READ NOW - asked of the app itself (its "state" command), not the server's last copy: for
 * checking a shell's own text reader (screen.ts / screen.android.ts).   run.js text [--app <shell>]
 */
module.exports = async (d) => {
  const r = await d.app.call({ t: 'state' }, 20000);
  const text = String((r && r.text) || '');
  d.say(`${text ? text.split('\n').length : 0} line(s) read now; the server's copy has ${d.app.text ? d.app.text.split('\n').length : 0}`);
  for (const l of text.split('\n').filter(Boolean).slice(0, 30)) d.say(`  ${l}`);
};

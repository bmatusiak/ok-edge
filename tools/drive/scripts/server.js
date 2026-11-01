'use strict';
/*
 * the user's server this app joins, set in the app (src/serverRoom.ts setServerUrl, kept in its storage):
 *   run.js server <url|off> [--app <shell>]
 * The box's phone: http://127.0.0.1:8787 - the stand-in's plain port, which the drive's android start reverses to the box.
 */
module.exports = async (d, [url]) => {
  if (!url) throw new Error('server <url|off>');
  d = await d.up();
  const r = await d.app.call({ t: 'server', url: url === 'off' ? null : url });
  if (!r.ok) throw new Error(`server: ${r.why}`);
  d.say(`${d.app.shell}: its server is ${url === 'off' ? "the key's site" : url}`);
};

'use strict';
/* the app reloads itself (a web page navigates again, React Native reloads its bundle), and is back:   run.js reload [--app <shell>] */
module.exports = async (d) => {
  d = await d.restarted(async () => {
    const r = await d.app.call({ t: 'reload' });
    if (!r.ok) throw new Error(`reload: ${r.why}`);
  });
  d.say(`${d.app.shell} reloaded`);
};

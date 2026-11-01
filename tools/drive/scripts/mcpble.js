'use strict';
/*
 * THE BOX'S HEADLESS MCP-SERVER WITH BLUETOOTH (targets.js mcp-ble; ok-edge plan B2):
 *   run.js mcpble start|stop|status [--app android]
 * The machine that has it answers (the box). status says its last lines - the "[ble]" state changes.
 */
module.exports = async (d, [what = 'status']) => {
  if (!['start', 'stop', 'status'].includes(what)) throw new Error('mcpble start|stop|status');
  const r = await d.machine(what, 'mcp-ble');
  if (!r.ok) throw new Error(`mcpble ${what} (${r.where || '?'}): ${r.why}`);
  const [first, ...rest] = String(r.what).split('\n');
  d.say(`${first} (${r.where})`);
  for (const l of rest) d.answer(l);
};

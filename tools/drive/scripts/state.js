'use strict';
/* what the app shows now: its net, its live controls, the start of its screen's text */
module.exports = async (d) => {
  d.say(`net ${d.app.net}; flags ${JSON.stringify(d.app.flags)}; top ${d.app.top} (layers ${(d.app.layers || []).join(' > ') || 'none'}); live: ${d.app.controls.filter((c) => c.enabled).map((c) => c.label).join(' | ') || '(none)'}`);
  for (const l of d.app.text.split('\n').filter(Boolean).slice(0, 25)) d.say(`  ${l}`);
};

/*
 * CONFIG MODE AS THE APP HOLDS IT (config-pin.yaml - Brad, 2026-11-03: "the purpose of this rehearsal is to check config
 * mode works as intended"): the app's own flag (MainApp configMode: wanted / pre / on / off) must read WANT within 20 s.
 * WHY: what this point of the flow proves, said with the pass.
 */
const want = String(typeof WANT === 'undefined' ? '' : WANT);
if (!/^(wanted|pre|on|off)$/.test(want)) throw new Error(`WANT must be wanted, pre, on or off (got "${want}")`);
const until = Date.now() + 20000;
while (drive.app.flags.configMode !== want) {
  if (Date.now() > until) throw new Error(`config mode: the app says "${drive.app.flags.configMode}", not "${want}"${typeof WHY === 'undefined' ? '' : ` - ${WHY}`}`);
  await new Promise((ok) => setTimeout(ok, 500));
}
drive.say(`config mode ${want}${typeof WHY === 'undefined' ? '' : `: ${WHY}`}`);

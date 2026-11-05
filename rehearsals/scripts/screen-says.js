/*
 * THE SCREEN SAYS IT, WITHIN 10 S: WANT, a piece of text the app's screen must show (its state's text - what a person
 * reads, not a control's label). A screen still settling gets its 10 s; then the run stops naming what it did say.
 */
const want = String(typeof WANT === 'undefined' ? '' : WANT);
if (!want) throw new Error('screen-says: WANT, the text the screen must show');
const until = Date.now() + 10000;
while (!String(drive.app.text || '').includes(want)) {
  if (Date.now() > until) throw new Error(`the screen does not say "${want}" - it says: ${String(drive.app.text || '').replace(/\s+/g, ' ').slice(0, 300)}`);
  await new Promise((ok) => setTimeout(ok, 300));
}
drive.say(`the screen says "${want}"`);

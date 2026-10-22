/*
 * Run IN THE PAGE by Electron (electron/main.js, OKEDGE_DRIVE) for tools/e2e-desktop.js: the same
 * walk tools/e2e.js makes on the phone through adb - Enter testing mode (if the login screen is up),
 * Menu, Testing, RUN TESTS - found by their text, as e2e.js finds them in the screen dump. Each
 * step logs "[drive] ..." so the runner shows where it is; a label that never comes fails naming
 * what is on screen.
 */
(async () => {
  /* injected on every load: one walk per page */
  if (window.__okedgeDrive) return;
  window.__okedgeDrive = true;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const say = (m) => console.log(`[drive] ${m}`);

  /*
   * the visible element whose own text is exactly the label - react-native-web draws Text as a div -
   * or whose aria-label is (an icon's accessibilityLabel: "Menu"), as uiautomator reads a phone's
   * text and content description alike
   */
  const visible = (el) => el.getClientRects().length > 0;
  const find = (label) => [...document.querySelectorAll('div, span')].find((el) =>
    el.childElementCount === 0 && el.textContent.trim() === label && visible(el))
    || [...document.querySelectorAll('[aria-label]')].find((el) => el.getAttribute('aria-label') === label && visible(el));
  const onScreen = () => [...new Set([...document.querySelectorAll('div, span')]
    .filter((el) => el.childElementCount === 0 && el.textContent.trim() && el.getClientRects().length > 0)
    .map((el) => el.textContent.trim()))].slice(0, 30).join(' | ');

  /* react-native-web's Pressable answers pointer events, then the click */
  const press = (el) => {
    const target = el.closest('[role="button"]') || el;
    target.scrollIntoView({ block: 'center' });
    const r = target.getBoundingClientRect();
    const at = { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerId: 1, isPrimary: true, button: 0 };
    target.dispatchEvent(new PointerEvent('pointerdown', at));
    target.dispatchEvent(new MouseEvent('mousedown', at));
    target.dispatchEvent(new PointerEvent('pointerup', at));
    target.dispatchEvent(new MouseEvent('mouseup', at));
    target.dispatchEvent(new MouseEvent('click', at));
  };

  async function waitFor(labels, timeoutMs) {
    const until = Date.now() + timeoutMs;
    for (;;) {
      for (const label of labels) { const el = find(label); if (el) return { label, el }; }
      if (Date.now() > until) throw new Error(`none of ${labels.map((l) => `"${l}"`).join(', ')} appeared within ${timeoutMs} ms - on screen: ${onScreen()}`);
      await sleep(400);
    }
  }

  try {
    const first = await waitFor(['Enter testing mode', 'Menu'], 180000);
    if (first.label === 'Enter testing mode') { say('entering testing mode'); press(first.el); await sleep(800); }
    else say('already past the login screen');
    /* testing mode may open on the Testing tab itself; otherwise Menu, then Testing */
    const next = await waitFor(['RUN TESTS', 'Menu'], 120000);
    if (next.label === 'Menu') {
      press(next.el);
      await sleep(600);
      press((await waitFor(['Testing'], 15000)).el);
      await sleep(1500);
    }
    const run = await waitFor(['RUN TESTS', 'RUNNING…', 'Running tests…'], 30000);
    if (run.label === 'RUN TESTS') { say('pressing RUN TESTS'); press(run.el); } else say('a run was already under way');
  } catch (e) {
    say(`FAILED: ${e.message}`);
  }
})();

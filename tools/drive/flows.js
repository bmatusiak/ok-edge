'use strict';
/*
 * The flows the drive scripts are made of - written once, for every shell (desktop, web app, Android). Each reads
 * where the app stands and takes the next move from there (PROPOSAL-drive.md 22); every move is a call on a live
 * control (1, 21) and every wait an event with a watchdog (2, 6).
 */

/*
 * THE DRIVEN SOFT KEYS' PIN: the app's own testing PIN (src/screens/TestingScreen.tsx TEST_PIN) - the Pixel's, and what
 * the in-app e2e suite unlocks with; a restore sets it. (The first desktop restores set 1111111, a PIN the e2e suite's
 * unlock test does not know, 2026-10-31.)
 */
const TEST_PIN = '1234561';
/*
 * A SOFT KEY WITH ANOTHER PIN (Brad, 2026-10-31: the box desktop's is the kit's 1111111 - each Login Bypass, which types
 * TEST_PIN, was a wrong PIN attempt, and ten wipe a key): run.js login|budget --pin <pin> names it, and the login types
 * it on the keypad - never the bypass. A bypass that leaves the key locked stops the run (no second wrong attempt).
 */

const LOGGED_IN = 'Slots — Soft Key';
const NO_BUDGET = 'No budget. A budget lets an agent use the key a set number of times without a press; you approve it once.';

/* into testing mode from the login screen; nothing to do when it is on already */
async function testingMode(d) {
  /* a screen still coming up is not judged: the login screen, or the app already on the testnet */
  await d.until((app) => app.has('Enter testing mode') || app.net === 'test', { life: 60, fail: [] });
  if (d.has('Enter testing mode')) {
    await d.step('testing mode', { goal: () => d.app.net === 'test', act: () => d.tap('Enter testing mode'), life: 30 });
  }
  /* and the tab it remembers is in place - the app says so (2026-10-31: a goto just after testing mode was undone by the remembered tab) */
  await d.until((app) => app.flags.tabSettled === 'main/testing' || app.flags.phase !== 'main', { life: 30, fail: [] });
}

/*
 * WHERE A LOGIN STANDS, as one name: the screen decides the next move. null = a screen still coming up ("Starting the
 * key…"), or one the login does not know - nothing is pressed on it (2026-10-31: a Menu seen for a moment while the
 * app started was gone by the time it was tapped).
 */
function loginState(app) {
  const f = app.flags;
  /*
   * THE APP'S FLAGS DECIDE, NEVER A LABEL (2026-10-31: the unlocked key's own buttons panel has a "Button 1" too - read
   * as "the keypad", it was pressed, which types a slot). Labels only name the moves: the buttons the app offers.
   */
  if (app.has('Enter testing mode')) return 'login screen';
  if (f.phase === 'main' && f.passed && !f.busy && (!app.top || app.has('Make the card'))) return 'in';
  /*
   * a menu or drawer a stopped run left open goes nowhere by itself (2026-10-31, the Pixel: the menu stayed open and the
   * login waited out its watchdog): closing it is the move - never a sheet, which may be a press being answered
   */
  /* the web app's "a newer build is out" sheet (Reload / Dismiss): in testing the newer build is the one wanted - reload into it */
  if (app.top && !f.busy && app.has('Reload') && app.has('Dismiss')) return 'Reload';
  /*
   * the phone's and the desktop's "a newer release is published" sheet (Download / Dismiss, src/ui/UpdateSheet.tsx; box,
   * 2026-11-04: a rehearsal waited 3 min behind it): the drive tests the build it runs, not the published one - Dismiss
   */
  if (app.top && !f.busy && app.has('Download') && app.has('Dismiss')) return 'close:Dismiss';
  /* the login card's sheet after a failed certify (Try again / Not now): the card again - its press is answered now */
  if (app.top && !f.busy && app.has('Not now') && app.has('Try again')) return 'card again';
  if (app.top && !f.busy) { const c = ['Close menu', 'Close Edge Management'].find((l) => app.has(l)); if (c) return `close:${c}`; }
  /*
   * A FINISHED SHEET LEFT OPEN (box web app, 2026-11-01: an Edge request's "copy_unverified" end sat on top and the
   * accept-loss flow's login waited on it for minutes): every control on it is Close (its ▼ handle and its button are
   * both "Close") - nothing is being answered there
   */
  if (app.top && !f.busy && app.controls.length && app.controls.every((c) => c.label === 'Close')) return 'close:Close';
  if (f.busy || app.top) return null;
  if (f.identityCheck) {
    /* a key whose site is not this page's: its "Go to <site>" is the move (the deployed flow - apps.crp.to first) */
    const go = app.controls.find((c) => c.enabled && /^Go to /.test(c.label));
    if (go) return go.label;
    return ['Try again', 'Continue', 'Decrypt Bucket', 'Create Bucket'].find((b) => app.has(b)) || null;
  }
  /*
   * a debug build's testing bar has Login Bypass (it types the testing PIN itself): the way a debug login goes (Brad,
   * 2026-10-07: "fix your way on logging in, now that we have the login bypass button") - the keypad only without it
   */
  if (f.key === 'locked' && app.has('Login Bypass')) return 'bypass';
  if (f.key === 'locked') return f.tab === 'This Key' ? 'keypad' : 'elsewhere';
  if (f.key === 'uninitialized') return 'not set up';
  return null;
}

/*
 * A KEY OUTSIDE THE APP, UNLOCKED FROM THE MACHINE THAT HOLDS IT (the web app's gadget soft key): a locked OnlyKey is
 * dark, an unlocked one green, and the machine sees the LED (targets.js keyState, "[gadget] led" lines). Dark: its PIN
 * on its buttons, ended by the LED's next colour. Never pressed on an unlocked key - a press there types a slot into
 * whatever has the focus. Only a key its machine names a testnet one.
 */
/*
 * UNLOCKED IS GREEN, NOT "NOT DARK" (box, 2026-11-02 01:49; Brad: "webapp can not detect if the key is locked or not" - only
 * the machine holding the key sees it, by its LED): the key's yellow-green "waiting for a touch" (#525c00) read as unlocked
 * a second before the PIN finished, Log in was tapped on a locked key, and its first request hung for minutes. Green: no
 * red, no blue, green past 0x40 (the steady unlocked colour is #00af00; its fade-in starts near black). Dark: locked.
 * Anything else (a touch wait, a fade) is neither - waited out.
 */
const GREEN = /led #00[4-9a-f][0-9a-f]00\b/;
const DARK = /led #000000\b/;
/*
 * RED, PULSING: UNLOCKED IN CONFIG MODE (box, 2026-11-03, the config-mode rehearsal: the PIN went in after the button-6
 * hold and the LED faded red #050000..#aa0000 - the key's config-mode colour - and this said "stayed dark - one wrong
 * attempt" of a right PIN). Any red with no green or blue that is not black.
 */
const CONFIG_RED = /led #(?!00)[0-9a-f]{2}0000\b/;
async function unlockOutsideKey(d, pin) {
  let s = await d.machine('key-state');
  /*
   * neither green nor dark: the LED is showing something else (a touch wait, a fade) - read again, 10 s at most. The
   * gadget's only: a hard key's state names no LED, and each of its reads is an OKCONNECT and a console probe - ten of
   * them ran into the Windows web app's first CTAP requests (2026-11-02, blue-key: "transit authentication failed or a
   * stale reply", seen on its firmware console between the browser's packets).
   */
  for (let i = 0; s.ok && !/^hard key 2/.test(s.what) && !GREEN.test(s.what) && !DARK.test(s.what) && i < 10; i++) {
    await new Promise((ok) => setTimeout(ok, 1000));
    s = await d.machine('key-state');
  }
  if (!s.ok) throw new Error(`the web app's key: ${s.why}`);
  if (!/\btestnet\b/.test(s.what)) throw new Error(`the web app's key is not a testnet one (${s.what}) - the drive does not unlock it`);
  if (!/: connected;/.test(s.what)) throw new Error(`the web app's key: ${s.what}`);
  /* one key on the USB: the browser asks every security key it sees, and a second one nobody presses holds the request */
  const many = s.what.match(/; (\d+) OnlyKeys on this machine's USB/);
  if (many && Number(many[1]) > 1) throw new Error(`${many[1]} OnlyKeys on the web app's machine - the browser asks them all; unplug the other one (or DRIVE_WEBAPP_KEY=hard to drive key 2 instead)`);
  /*
   * HARD KEY 2 (DRIVE_WEBAPP_KEY=hard): its state is the CLI's read, its PIN the kit's. Pressed only when it reads
   * "locked" - a press on a locked hard key is a PIN attempt (ten wipe it), on an unlocked one it types a slot - and
   * read again after, 2 s apart, ten reads at most (each read is a request to the key: no more than that).
   */
  if (/^hard key 2/.test(s.what)) {
    if (/state unlocked/.test(s.what)) { d.say('its key (hard key 2) is unlocked'); return; }
    if (!/state locked/.test(s.what)) throw new Error(`the web app's key: ${s.what} - not pressed: its state is not read as locked`);
    d.say('its key (hard key 2) is locked - the kit PIN on its buttons, through its debug console');
    const r = await d.machine('press', d.app.shell, { buttons: '1111111'.split('') });
    if (!r.ok) throw new Error(`the web app's key: ${r.why}`);
    for (let i = 0; i < 10; i++) {
      await new Promise((ok) => setTimeout(ok, 2000));
      const n = await d.machine('key-state');
      if (n.ok && /state unlocked/.test(n.what)) { d.say('its key (hard key 2) is unlocked'); return; }
    }
    throw new Error('hard key 2 did not read unlocked within 20 s of its PIN - nothing more is pressed');
  }
  if (GREEN.test(s.what)) { d.say(`its key is unlocked (${s.what.replace(/^.*?: /, '')})`); return; }
  if (CONFIG_RED.test(s.what)) throw new Error(`the key is in config mode (its LED pulses red) - it ends only at a restart (unplugKey / plugKey); nothing pressed`);
  if (!DARK.test(s.what)) throw new Error(`the web app's key: its LED is neither green (unlocked) nor dark (locked) after 10 s - ${s.what.replace(/^.*?: /, '')}; nothing pressed`);
  d.say('its key is locked (dark) - its PIN on its buttons');
  /* the web app's stream carries the gadget's "[gadget] led" lines; the desktop's does not - it reads the LED its machine holds */
  const lit = d.app.shell === 'webapp' ? d.until(/\[gadget\] led #00[4-9a-f][0-9a-f]00\b/, { life: 20, fail: [] }) : null;
  const r = await d.machine('press', d.app.shell, { buttons: pin.split('') });
  if (!r.ok) throw new Error(`the web app's key: ${r.why}`);
  if (lit) await lit;
  else {
    /* the machine's last LED seen, read every second - its own record, never a request to the key - 20 s at most */
    for (let i = 0; ; i++) {
      const n = await d.machine('key-state');
      if (n.ok && GREEN.test(n.what)) break;
      if (n.ok && CONFIG_RED.test(n.what)) { d.say('its key is unlocked, in config mode (its LED pulses red)'); return; }
      if (i >= 20) throw new Error(`the gadget stayed dark 20 s after its PIN - one wrong attempt; not tried again`);
      await new Promise((ok) => setTimeout(ok, 1000));
    }
  }
  d.say('its key is unlocked');
}

/*
 * THE DESKTOP ON THE GADGET (box, 2026-11-01: blue-key unplugged so the desktop, the web app and the phone hold one
 * identity): the gadget is a soft key's firmware, with no debug console - the desktop's keypad, which presses a hard key
 * through its console, never comes live for it. So it is unlocked as the web app's is: from its machine (unlockOutsideKey).
 */
async function onGadget(d) {
  if (d.app.shell !== 'desktop') return false;
  const s = await d.machine('key-state');
  /* the gadget, or the Pi relay key (optional - tools/drive/pikey.js): a soft key the drive unlocks from outside the app */
  return s.ok && /\((gadget|pi relay)\): connected;/.test(String(s.what));
}

/*
 * logged in to the soft key, as a state machine: look, take the one move that state calls for, wait for the state to
 * change, look again - from the login screen, the keypad, the identity check, a failed try, another tab
 */
/* key: 'soft' - the desktop logs in on its own testnet soft key even while the box's gadget is up (onGadget is not asked) */
async function loginMoves(d, { pin = TEST_PIN, life = 180, key = null } = {}) {
  const gadget = (dd) => (key === 'soft' ? Promise.resolve(false) : onGadget(dd));
  const until = Date.now() + life * 1000;
  /*
   * A STATE COME BACK IS A FAILED MOVE (Brad, 2026-11-03: "button press login is looping, no button press" - Continue,
   * its press never given, the login back at Continue, every 30 s): the run stops there (fail fast) - run.js
   * --fail-retry N lets a state come back N times.
   */
  const seen = new Map();
  for (let moves = 0; moves < 12; moves++) {
    const left = Math.max(5, Math.round((until - Date.now()) / 1000));
    const now = await d.until((app) => loginState(app) !== null, { life: left, fail: [] }).then(() => loginState(d.app));
    /*
     * THE STATE READ AGAIN CAN BE NONE (box desktop, 2026-11-01: the identity check went busy between the wait and the
     * read - "login: null", the run stopped on null.startsWith, and the login budget's press that came 14 s later was
     * left unanswered): nothing to do yet - wait for the next state
     */
    if (now === null) continue;
    if (now === 'in') {
      d.say(moves ? 'logged in' : 'logged in already');
      /*
       * THE LOGIN CARD, WHEN OFFERED (2026-10-31, the web app: its sheet stayed over the screen and the next flow could
       * not reach the menu): made here - one certify press, the testnet's - so every flow starts from a screen with
       * nothing over it. The restore flow made it alone before; now every login does.
       */
      if (d.app.controls.some((c) => c.label === 'Make the card' && c.enabled)) {
        await d.step('the login card', { goal: /\[card\] .*certified at/, act: () => d.tap('Make the card') });
      }
      return d;
    }
    d.say(`login: ${now}`);
    const times = (seen.get(now) || 0) + 1;
    if (times > 1 + (d.failRetry || 0)) throw new Error(`login: "${now}" again after its move - stopped (fail fast; run.js --fail-retry N tries again)`);
    seen.set(now, times);
    if (now.startsWith('close:')) await d.tap(now.slice(6));
    else if (now === 'card again') { await d.step('the login card', { goal: /\[card\] .*certified at/, act: () => d.tap('Try again') }); continue; }
    else if (now.startsWith('Go to ') || now === 'Reload') {
      /* the key's site (or the newer build) loads in its place - a new connection: the drive goes on with it (its hello) */
      /* the page may navigate before it answers the tap: its connection closing is the tap having worked */
      const tap = now;
      d = await d.restarted(() => d.tap(tap).catch((e) => { if (!/disconnected|went|gone/.test(e.message)) throw e; }));
      continue;
    }
    else if (now === 'login screen') {
      /* the web app's chain is its key's - the gadget is a testnet key: unlocked from its machine, then Log in */
      if (d.app.shell === 'webapp' || await gadget(d)) { await unlockOutsideKey(d, pin); await d.tap('Log in'); } else await d.tap('Enter testing mode');
    }
    else if (now === 'bypass' && pin !== TEST_PIN) {
      /* the bypass types TEST_PIN, not this key's: the keypad with its own PIN */
      /* the state stays "bypass" while its button shows: each move ends on its own goal, not on a state change */
      if (d.app.flags.tab !== 'This Key') { seen.delete(now); await d.goto('This Key'); continue; }
      for (const n of pin) await d.tap(`Button ${n}`);
      await d.until((app) => app.flags.key !== 'locked', { life: 60, fail: [] }).catch(() => {
        throw new Error(`login: the key stayed locked after its PIN on the keypad (--pin ${pin.length} digits) - one wrong attempt; not tried again`);
      });
      continue;
    }
    else if (now === 'bypass') {
      /*
       * its end is the key unlocked - the bypass types seven digits, and while it does the key is still "locked" with
       * no button live (2026-10-31, the Pixel: judged "elsewhere" mid-bypass, a Menu tap found nothing)
       *
       * NOT BEFORE THE SOFT KEY ANSWERS (the Pixel, 2026-11-01: the bypass tapped 0.3 s after the firmware started lost
       * digits; the key kept the rest - it checks as each digit lands, and a broken entry starts over only with a hold or
       * an unplug - so the next bypass was wrong too): this app start's "[softkey] OKCONNECT ok" first.
       */
      const r = d.app.recent || [];
      let start = -1;
      for (let i = r.length - 1; i >= 0; i--) if (/Running "main"/.test(r[i])) { start = i; break; }
      if (!r.slice(start + 1).some((l) => /\[softkey\] OKCONNECT ok/.test(l))) {
        await d.until(/\[softkey\] OKCONNECT ok/, { life: 60, fail: [] });
      }
      await d.tap('Login Bypass');
      await d.until((app) => app.flags.key !== 'locked', { life: 60, fail: [] }).catch(() => {
        throw new Error(`login: the key stayed locked after Login Bypass (${TEST_PIN}) - one wrong PIN attempt; not tried again. Its PIN: --pin <pin>`);
      });
      continue;
    }
    else if (now === 'keypad' && await gadget(d)) await unlockOutsideKey(d, pin);
    /*
     * A SOFT-KEY LOGIN NEVER TYPES ON A USB KEY'S KEYPAD (box desktop, 2026-11-01: the gadget on the box's USB was the
     * desktop's key, "Enter testing mode" did not change that, and the testing PIN went to the gadget - a wrong attempt).
     * A key whose debug console answers is a USB key, not the soft key: stopped, nothing typed.
     */
    else if (now === 'keypad' && key === 'soft' && d.app.flags.consoleAnswers === true) {
      throw new Error('login: the keypad is a USB key\'s, not the soft key\'s (its console answers) - nothing typed; take the USB key off first (the box gadget: machine use-key hard)');
    }
    else if (now === 'keypad') { for (const n of pin) await d.tap(`Button ${n}`); }
    else if (now === 'elsewhere') await d.goto('This Key');
    /*
     * the LIVE soft key blank, its setup page up (the Pixel, 2026-11-01: a fresh install's restart lands there, the
     * testnet key set up and the live one never) - the drive's login is the testnet's, and testing mode stays off while
     * the live soft key runs (LoginScreen: one net per run): the app restarted, then testing mode
     */
    else if (now === 'not set up' && d.app.net !== 'test') d = await d.restart();
    else if (now === 'not set up') throw new Error('login: the soft key is not set up (a restore or setup comes first)');
    else {
      /*
       * A MOVE ONLY WHILE ITS STATE HOLDS: the identity check can go on by itself ("Decrypt Bucket" showed for an instant,
       * the kept bucket opened with no press, and a tap waiting for that button failed a login that had succeeded,
       * 2026-10-31) - the button live, or the state moved on; only the first is tapped
       */
      await d.until((app) => app.controls.some((c) => c.label === now && c.enabled) || loginState(app) !== now, { life: 30, fail: [] });
      if (loginState(d.app) === now) await d.tap(now, { unless: (app) => loginState(app) !== now });
    }
    /* the move's effect: the state is another one (or the login is in) */
    await d.until((app) => { const s = loginState(app); return s !== null && s !== now; }, { life: Math.max(5, Math.round((until - Date.now()) / 1000)), fail: [] });
  }
  throw new Error('login: twelve moves and not in');
}

/*
 * THE LOGIN, ACROSS A PAGE THAT RELOADS ITSELF (2026-10-31: the web app's first visit to the key's site reloads once for
 * its service worker and newest build, before it can say so): the page's going mid-login is waited out - its next
 * hello, under the restart's watchdog - and the login goes on with it, three times at most. Returns the drive for the
 * page it ends on.
 */
async function login(d, opts = {}) {
  for (let reloads = 0; ; reloads++) {
    try {
      return await loginMoves(d, opts);
    } catch (e) {
      if (reloads >= 3 || !/the app disconnected|is not connected|the app went/.test(e.message)) throw e;
      d.say(`the ${d.app.shell} page went mid-login (a reload) - going on with its next connection`);
      d = await d.restarted();
    }
  }
}

/* one budget on the soft key: asked, approved (its press answered by the server), three signs it pays */
async function budget(d) {
  if (d.has('Close Edge Management')) await d.tap('Close Edge Management');
  await d.goto('Edge');
  if (!d.has('Active')) {
    if (!d.has('Approve')) {
      await d.tap('Open Edge Management');
      await d.tap('Agent: request a budget');
      await d.tap('Close Edge Management');
    }
    await d.step('approve the budget', { goal: 'Active', act: () => d.tap('Approve') });
  }
  /* from the count the screen shows (22) */
  const spent = Number((d.app.text.match(/^([0-9]) of 3 uses spent$/m) || [])[1] || 0);
  for (let i = spent + 1; i <= 3; i++) {
    await d.step(`sign ${i} of 3`, {
      goal: i < 3 ? `${i} of 3 uses spent` : NO_BUDGET,
      act: async () => {
        await d.tap('Open Edge Management');
        await d.tap('Agent: a sign the budget pays');
        await d.tap('Close Edge Management');
      },
    });
  }
}

/*
 * the soft key wiped, set up as a new device from a backup, logged in, its login card made. The backup and its
 * passphrase are read from files on the server's machine and never logged (19).
 */
async function restore(d, { backup, passphraseFile, passphraseKey = 'passphrase', pin = TEST_PIN }) {
  await testingMode(d);
  await d.goto('Testing');
  await d.tap('Factory reset');
  d = await d.restarted(async () => { await d.tap('Really wipe it'); await d.tap('Restart the app'); });
  await testingMode(d);
  /* a blank key's setup is the Setup tab (SetupFlowScreen): the restore ticked on its first page, then the PIN */
  await d.goto('Setup');
  await d.tap('Restore a backup');
  await d.tap('Continue');
  await d.until('Choose a PIN', { life: 30 });
  for (const pass of ['Next', 'Set the PIN']) {
    for (const n of pin) await d.tap(`Button ${n}`);
    await d.tap(pass);
  }
  /* the restore was ticked: the PIN set, its page comes next */
  await d.fillFile('-----BEGIN ONLYKEY BACKUP-----', backup);
  await d.fillFile("the backup's passphrase", passphraseFile, passphraseKey);
  await d.tap('Restore');
  d = await d.restarted(() => d.tap('Restart the app'), { life: 120 });
  /* the login makes this device's login card when it is offered (login) */
  d = await login(d, { pin });
  return d;
}

/*
 * THE WEB APP'S KEY READY BEFORE A RUN USES IT (Brad, 2026-11-02: "webapp, if key is locked, won't respond for webapp -
 * so you need to make sure, externally, before using webapp, the key state"): the server asks this before a login,
 * rehearsal or budget run on the web app - the key's machine reads its LED, and a dark (locked) testnet key gets its PIN.
 * The key locks itself after a while unused (the box gadget's ~30 min, 2026-11-02 00:36), so a run that starts later
 * would otherwise send its first request to a locked key, which never answers it.
 */
async function keyReady(d, pin = TEST_PIN) {
  if (d.app.shell !== 'webapp') return;
  await unlockOutsideKey(d, pin);
}

module.exports = { login, budget, restore, testingMode, keyReady, LOGGED_IN };

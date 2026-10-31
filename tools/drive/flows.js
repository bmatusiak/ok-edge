'use strict';
/*
 * The flows the drive scripts are made of - written once, for every shell (desktop, web app, Android). Each reads
 * where the app stands and takes the next move from there (PROPOSAL-drive.md 22); every move is a call on a live
 * control (1, 21) and every wait an event with a watchdog (2, 6).
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
  if (f.busy || app.top) return null;
  if (f.identityCheck) return ['Try again', 'Decrypt Bucket', 'Create Bucket'].find((b) => app.has(b)) || null;
  if (f.key === 'locked') return f.tab === 'This Key' ? 'keypad' : 'elsewhere';
  if (f.key === 'uninitialized') return 'not set up';
  return null;
}

/*
 * logged in to the soft key, as a state machine: look, take the one move that state calls for, wait for the state to
 * change, look again - from the login screen, the keypad, the identity check, a failed try, another tab
 */
async function login(d, { pin = '1111111', life = 180 } = {}) {
  const until = Date.now() + life * 1000;
  for (let moves = 0; moves < 12; moves++) {
    const left = Math.max(5, Math.round((until - Date.now()) / 1000));
    const now = await d.until((app) => loginState(app) !== null, { life: left, fail: [] }).then(() => loginState(d.app));
    if (now === 'in') { d.say(moves ? 'logged in' : 'logged in already'); return; }
    d.say(`login: ${now}`);
    if (now === 'login screen') await d.tap('Enter testing mode');
    else if (now === 'keypad') { for (const n of pin) await d.tap(`Button ${n}`); }
    else if (now === 'elsewhere') await d.goto('This Key');
    else if (now === 'not set up') throw new Error('login: the soft key is not set up (a restore or setup comes first)');
    else await d.tap(now);
    /* the move's effect: the state is another one (or the login is in) */
    await d.until((app) => { const s = loginState(app); return s !== null && s !== now; }, { life: Math.max(5, Math.round((until - Date.now()) / 1000)), fail: [] });
  }
  throw new Error('login: twelve moves and not in');
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
async function restore(d, { backup, passphraseFile, passphraseKey = 'passphrase', pin = '1111111' }) {
  await testingMode(d);
  await d.goto('Testing');
  await d.tap('Factory reset');
  d = await d.restarted(async () => { await d.tap('Really wipe it'); await d.tap('Restart the app'); });
  await testingMode(d);
  await d.goto('This Key');
  await d.until('Choose a PIN', { life: 30 });
  for (const pass of ['Next', 'Set the PIN']) {
    for (const n of pin) await d.tap(`Button ${n}`);
    await d.tap(pass);
  }
  await d.tap('Restore a backup');
  await d.fillFile('-----BEGIN ONLYKEY BACKUP-----', backup);
  await d.fillFile("the backup's passphrase", passphraseFile, passphraseKey);
  await d.tap('Restore');
  d = await d.restarted(() => d.tap('Restart the app'), { life: 120 });
  await login(d, { pin });
  await d.step('the login card', { goal: /\[card\] .*certified at/, act: () => d.tap('Make the card') });
  return d;
}

module.exports = { login, budget, restore, testingMode, LOGGED_IN };

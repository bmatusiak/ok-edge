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
  if (d.has('Enter testing mode')) {
    await d.step('testing mode', { goal: () => d.app.net === 'test', act: () => d.tap('Enter testing mode'), life: 30 });
  }
}

/* logged in to the soft key: from the login screen, the keypad, the identity check, or a failed try */
async function login(d, { pin = '1111111' } = {}) {
  await testingMode(d);
  if (d.has(LOGGED_IN)) { d.say('logged in already'); return; }
  if (!d.has('Try again') && !d.has('Decrypt Bucket') && !d.has('Create Bucket') && !d.has('Button 1')) await d.goto('This Key');
  for (const b of ['Try again', 'Decrypt Bucket', 'Create Bucket']) {
    if (d.has(b)) { await d.step(`log in (${b})`, { goal: LOGGED_IN, act: () => d.tap(b) }); return; }
  }
  await d.step('log in (PIN)', {
    goal: LOGGED_IN,
    act: async () => { for (const n of pin) await d.tap(`Button ${n}`); },
  });
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

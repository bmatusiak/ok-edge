'use strict';
/*
 * The sheet inspector's rules, each on the lines an app says (tools/drive/sheets.js) - the sheet bugs Brad found on
 * 2026-11-02 among them, as they would read in the app's log. The truth is the lib's "[request] press" line
 * (src/requestLog.ts), never the key's LED.   node --test tools/drive/sheets.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSheetInspector, NO_SHEET_MS, STALE_MS, NO_PROGRESS_MS, IDLE_MS } = require('./sheets');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function inspector() {
  const fails = [];
  const events = [];
  const j = createSheetInspector({ fail: (w) => fails.push(w), event: (e) => events.push(e.kind) });
  return { j, fails, events, say: (...ls) => ls.forEach((l) => j.line(l)) };
}

const CERTIFY = 'Edge: certifying (press the key)';
const BUDGET = 'Edge: opening a budget';

test('a press asked with its sheet, answered, the sheet gone, the progress after it: no failure', async () => {
  const { j, fails, events, say } = inspector();
  say(`[timeline] 1 begin #1 ${CERTIFY}`, `[request] press asked: ${CERTIFY} - a press`, '[press] icon up (usb)');
  await wait(200);
  say(`[request] press done: ${CERTIFY} - answered`, '[press] icon down', `[timeline] 2 end #1 ${CERTIFY} steps=2 ok`,
    '[timeline] 3 begin #2 Edge: reading the chain head', '[sheet] progress up: Edge: reading the chain head');
  await wait(NO_PROGRESS_MS + 200);
  say('[timeline] 4 end #2 Edge: reading the chain head steps=1 ok', '[sheet] progress down');
  j.stop();
  assert.deepEqual(fails, []);
  assert.deepEqual(events, ['press', 'none', 'progress', 'none']);
});

test('no press sheet: the lib asks a press and nothing on screen asks for it - the nametag on a USB key', async () => {
  const { j, fails, say } = inspector();
  say(`[request] press asked: ${CERTIFY} - a press`);
  await wait(NO_SHEET_MS + 200);
  j.stop();
  assert.equal(fails.length, 1);
  assert.match(fails[0], /^no press sheet/);
});

test('no press sheet for a CLI\'s press through the desktop app (its code said)', async () => {
  const { j, fails, say } = inspector();
  say('[edge] press approved: a test signature', '[request] press asked: signing (the CLI) - code 3 1 5');
  await wait(NO_SHEET_MS + 200);
  j.stop();
  assert.match(fails[0] || '', /^no press sheet.*signing \(the CLI\)/);
});

test('no code: an agent sign wants 5 2 3 and the sheet that shows says only "press" - the Pi login', async () => {
  const { j, fails, say } = inspector();
  say('[edge] press approved: a test signature', '[request] press asked: signing (the CLI) - code 5 2 3', '[press] icon up (usb)');
  await wait(NO_SHEET_MS + 200);
  j.stop();
  assert.equal(fails.length, 1);
  assert.match(fails[0], /^no code: the key wants 5 2 3/);
});

test('a code the sheet shows (even a moment before the lib\'s line) passes', async () => {
  const { j, fails, say } = inspector();
  say('[press] icon up (usb)', '[press] code shows: deriving a secret - buttons 3 3 5', '[request] press asked: deriving a secret - code 3 3 5');
  await wait(NO_SHEET_MS + 200);
  j.stop();
  assert.deepEqual(fails, []);
});

test('the soft key\'s code is its own buttons\' - not asked of a sheet', async () => {
  const { j, fails, say } = inspector();
  say('[press] icon up (embedded)', '[request] press asked: signing - code 1 2 3');
  await wait(NO_SHEET_MS + 200);
  j.stop();
  assert.deepEqual(fails, []);
});

test('stale press sheet: the key answered and the sheet stays - the login on Windows', async () => {
  const { j, fails, say } = inspector();
  say('[press] key waits: Open this identity\'s bucket - buttons any', '[press] icon up (usb)', `[timeline] 1 begin #10 ${BUDGET}`,
    `[request] press asked: ${BUDGET} - a press`);
  await wait(100);
  say(`[request] press done: ${BUDGET} - answered`, `[timeline] 2 end #10 ${BUDGET} steps=2 ok`, '[timeline] 3 begin #11 deriving a secret');
  await wait(STALE_MS + 200);
  j.stop();
  assert.ok(fails.some((f) => /^stale press sheet/.test(f)), fails.join(' | '));
});

test('stale press sheet by events: a fast key\'s next request runs and ends under the press sheet - no waiting needed', () => {
  const { j, fails, say } = inspector();
  say('[press] key waits: Open this identity\'s bucket - buttons any', '[press] icon up (usb)', `[timeline] 1 begin #10 ${BUDGET}`,
    `[request] press asked: ${BUDGET} - a press`, `[request] press done: ${BUDGET} - answered`, `[timeline] 2 end #10 ${BUDGET} steps=2 ok`,
    '[timeline] 3 begin #11 Edge: reading the chain head', '[timeline] 4 end #11 Edge: reading the chain head steps=1 ok');
  j.stop();
  assert.equal(fails.length, 1);
  assert.match(fails[0], /^stale press sheet: "Edge: reading the chain head" ran and finished after the key answered/);
});

test('the next request that asks its own code is not run under a stale sheet', () => {
  const { j, fails, say } = inspector();
  say('[press] icon up (usb)', `[request] press asked: ${BUDGET} - a press`, `[request] press done: ${BUDGET} - answered`,
    '[timeline] 1 begin #12 deriving a secret', '[request] press asked: deriving a secret - code 3 3 5', '[press] code shows: deriving a secret - buttons 3 3 5',
    '[request] press done: deriving a secret - answered', '[timeline] 2 end #12 deriving a secret steps=3 ok', '[press] icon down');
  j.stop();
  assert.deepEqual(fails, []);
});

test('press sheet swapped: one press shows "Press your OnlyKey", takes it away, shows "Press the key" - the card login', () => {
  const { j, fails, say } = inspector();
  say(`[request] press asked: ${BUDGET} - a press`, '[press] icon up (usb)', '[press] icon down', '[press] icon up (usb)');
  j.stop();
  assert.equal(fails.length, 1);
  assert.match(fails[0], /^press sheet swapped/);
});

test('one press, one sheet: no swap', () => {
  const { j, fails, say } = inspector();
  say(`[request] press asked: ${BUDGET} - a press`, '[press] icon up (usb)', `[request] press done: ${BUDGET} - answered`, '[press] icon down');
  j.stop();
  assert.deepEqual(fails, []);
});

test('user state exposed: the agent identity\'s sheet still open after the key went - the unplug', async () => {
  const { j, fails, say } = inspector();
  say('[sheet] height 420: Agent identity', '[identity] the key went: its state forgotten');
  await wait(1200);
  j.stop();
  assert.equal(fails.length, 1);
  assert.match(fails[0], /^user state exposed: "Agent identity" still open/);
});

test('the key went and its sheets closed with it: no failure', async () => {
  const { j, fails, say } = inspector();
  say('[sheet] height 420: Agent identity', '[identity] the key went: its state forgotten', '[sheet] closed: Agent identity');
  await wait(1200);
  j.stop();
  assert.deepEqual(fails, []);
});

test('press unapproved: a CLI press reaches the key with no approval in the app - "i dont know what i was approving"', () => {
  const { j, fails, say } = inspector();
  say('[press] icon up (usb)', '[request] press asked: signing (the CLI) - code 2 4 2', '[press] code shows: signing (the CLI) - buttons 2 4 2');
  j.stop();
  assert.ok(fails.some((f) => /^press unapproved/.test(f)), fails.join(' | '));
});

test('a CLI press approved first, one approval each', () => {
  const { j, fails, say } = inspector();
  say("[edge] press approved: sign the agent's PGP certificate", '[press] icon up (usb)', '[request] press asked: signing (the CLI) - code 2 4 2', '[press] code shows: signing (the CLI) - buttons 2 4 2',
    '[request] press done: signing (the CLI) - answered', '[press] icon down',
    "[edge] press approved: sign the agent's PGP certificate", '[press] icon up (usb)', '[request] press asked: signing (the CLI) - code 1 1 3', '[press] code shows: signing (the CLI) - buttons 1 1 3');
  j.stop();
  assert.deepEqual(fails, []);
});

test('budget unnamed: the login\'s press sheet says only "Edge: opening a budget" - "what budget am i pressing for?"', async () => {
  const { j, fails, say } = inspector();
  say(`[request] press asked: ${BUDGET} - a press`, `[press] key waits: ${BUDGET} - buttons any`, '[press] icon up (usb)');
  await wait(NO_SHEET_MS + 200);
  j.stop();
  assert.ok(fails.some((f) => /^press without why/.test(f)), fails.join(' | '));
});

test('a budget\'s press sheet that says what the budget is for passes', async () => {
  const { j, fails, say } = inspector();
  say(`[request] press asked: ${BUDGET} - a press`, `[press] key waits: ${BUDGET} - buttons any`, '[press] icon up (usb)',
    "[press] key waits: Log in - one budget for this login's own key requests - buttons any");
  await wait(NO_SHEET_MS + 200);
  j.stop();
  assert.deepEqual(fails, []);
});

test('no progress: requests run after the press and no sheet shows them', async () => {
  const { j, fails, say } = inspector();
  say(`[request] press asked: ${BUDGET} - a press`, '[press] icon up (usb)');
  await wait(100);
  say(`[request] press done: ${BUDGET} - answered`, '[press] icon down', '[timeline] 1 begin #3 signing');
  await wait(NO_PROGRESS_MS + 200);
  j.stop();
  assert.equal(fails.length, 1);
  assert.match(fails[0], /^no progress/);
});

test('a new press asked after an answer is not a stale sheet (a derive\'s code after the budget\'s press)', async () => {
  const { j, fails, say } = inspector();
  say(`[request] press asked: ${BUDGET} - a press`, '[press] icon up (usb)');
  await wait(100);
  say(`[request] press done: ${BUDGET} - answered`, '[request] press asked: deriving a secret - code 3 3 5', '[press] code shows: deriving a secret - buttons 3 3 5');
  await wait(STALE_MS + 200);
  j.stop();
  assert.deepEqual(fails, []);
});

test('the key\'s LED is no part of it: a gadget line asks nothing', async () => {
  const { j, fails, say } = inspector();
  say('[main] [gadget] led #525200');
  await wait(NO_SHEET_MS + 200);
  j.stop();
  assert.deepEqual(fails, []);
});

test('sheet jumps: a sheet back at the height it just left - the time bar coming and going', () => {
  const { j, fails, say } = inspector();
  say('[sheet] height 300: Working with your key', '[sheet] height 312: Working with your key', '[sheet] height 300: Working with your key');
  j.stop();
  assert.equal(fails.length, 1);
  assert.match(fails[0], /^sheet jumps/);
});

test('a sheet that grows and stays (new words) does not jump', () => {
  const { j, fails, say } = inspector();
  say('[sheet] height 300: Working with your key', '[sheet] height 312: Working with your key', '[sheet] height 330: Working with your key');
  j.stop();
  assert.deepEqual(fails, []);
});

test('the presser asks: a press sheet that comes within the time counts, none does not', async () => {
  const { j, say } = inspector();
  const later = j.pressSheet(500);
  setTimeout(() => say('[press] icon up (usb)'), 100);
  assert.equal(await later, true);
  say('[press] icon down');
  assert.equal(await j.pressSheet(200), false);
  j.stop();
});

test('idle press sheet: up with nothing asked of the key', { timeout: IDLE_MS + 3000 }, async () => {
  const { j, fails, say } = inspector();
  say('[press] icon up (usb)');
  await wait(IDLE_MS + 300);
  j.stop();
  assert.equal(fails.length, 1);
  assert.match(fails[0], /^idle press sheet/);
});

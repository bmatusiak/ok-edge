'use strict';
/*
 * The sheet judge's rules, each on the lines an app says (tools/drive/sheets.js) - the sheet bugs Brad found on
 * 2026-11-02 among them, as they would read in the app's log. The truth is the lib's "[request] press" line
 * (src/requestLog.ts), never the key's LED.   node --test tools/drive/sheets.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSheetJudge, NO_SHEET_MS, STALE_MS, NO_PROGRESS_MS, IDLE_MS } = require('./sheets');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function judge() {
  const fails = [];
  const events = [];
  const j = createSheetJudge({ fail: (w) => fails.push(w), event: (e) => events.push(e.kind) });
  return { j, fails, events, say: (...ls) => ls.forEach((l) => j.line(l)) };
}

const CERTIFY = 'Edge: certifying (press the key)';
const BUDGET = 'Edge: opening a budget';

test('a press asked with its sheet, answered, the sheet gone, the progress after it: no failure', async () => {
  const { j, fails, events, say } = judge();
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
  const { j, fails, say } = judge();
  say(`[request] press asked: ${CERTIFY} - a press`);
  await wait(NO_SHEET_MS + 200);
  j.stop();
  assert.equal(fails.length, 1);
  assert.match(fails[0], /^no press sheet/);
});

test('no press sheet for a CLI\'s press through the desktop app (its code said)', async () => {
  const { j, fails, say } = judge();
  say('[request] press asked: signing (the CLI) - code 3 1 5');
  await wait(NO_SHEET_MS + 200);
  j.stop();
  assert.match(fails[0] || '', /^no press sheet.*signing \(the CLI\)/);
});

test('stale press sheet: the key answered and the sheet stays - the login on Windows', async () => {
  const { j, fails, say } = judge();
  say('[press] key waits: Open this identity\'s bucket - buttons any', '[press] icon up (usb)', `[timeline] 1 begin #10 ${BUDGET}`,
    `[request] press asked: ${BUDGET} - a press`);
  await wait(100);
  say(`[request] press done: ${BUDGET} - answered`, `[timeline] 2 end #10 ${BUDGET} steps=2 ok`, '[timeline] 3 begin #11 deriving a secret');
  await wait(STALE_MS + 200);
  j.stop();
  assert.ok(fails.some((f) => /^stale press sheet/.test(f)), fails.join(' | '));
});

test('no progress: requests run after the press and no sheet shows them', async () => {
  const { j, fails, say } = judge();
  say(`[request] press asked: ${BUDGET} - a press`, '[press] icon up (usb)');
  await wait(100);
  say(`[request] press done: ${BUDGET} - answered`, '[press] icon down', '[timeline] 1 begin #3 signing');
  await wait(NO_PROGRESS_MS + 200);
  j.stop();
  assert.equal(fails.length, 1);
  assert.match(fails[0], /^no progress/);
});

test('a new press asked after an answer is not a stale sheet (a derive\'s code after the budget\'s press)', async () => {
  const { j, fails, say } = judge();
  say(`[request] press asked: ${BUDGET} - a press`, '[press] icon up (usb)');
  await wait(100);
  say(`[request] press done: ${BUDGET} - answered`, '[request] press asked: deriving a secret - code 3 3 5');
  await wait(STALE_MS + 200);
  j.stop();
  assert.deepEqual(fails, []);
});

test('the key\'s LED is no part of it: a gadget line asks nothing', async () => {
  const { j, fails, say } = judge();
  say('[main] [gadget] led #525200');
  await wait(NO_SHEET_MS + 200);
  j.stop();
  assert.deepEqual(fails, []);
});

test('sheet jumps: a sheet changing height three times within the window - the time bar coming and going', () => {
  const { j, fails, say } = judge();
  say('[sheet] height 300: Working with your key', '[sheet] height 312: Working with your key', '[sheet] height 300: Working with your key');
  j.stop();
  assert.equal(fails.length, 1);
  assert.match(fails[0], /^sheet jumps/);
});

test('the presser asks: a press sheet that comes within the time counts, none does not', async () => {
  const { j, say } = judge();
  const later = j.pressSheet(500);
  setTimeout(() => say('[press] icon up (usb)'), 100);
  assert.equal(await later, true);
  say('[press] icon down');
  assert.equal(await j.pressSheet(200), false);
  j.stop();
});

test('idle press sheet: up with nothing asked of the key', { timeout: IDLE_MS + 3000 }, async () => {
  const { j, fails, say } = judge();
  say('[press] icon up (usb)');
  await wait(IDLE_MS + 300);
  j.stop();
  assert.equal(fails.length, 1);
  assert.match(fails[0], /^idle press sheet/);
});

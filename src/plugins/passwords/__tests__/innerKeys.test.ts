/*
 * An entry's secrets under its own press (src/plugins/passwords/innerKeys.ts): sealed with the touch
 * derive of its id, opened with one press, sealed again on the same visit with no second press.
 */
import {sha256} from 'node-onlykey-lib/vendor/@noble/hashes/sha2.js';
import {openEntry, sealEntry} from '../innerKeys';

jest.mock('../../../hostChallenge', () => ({challengeOpts: () => ({opts: {confirm: () => undefined}, done: () => undefined})}));

const ID = 'ab12cd34';

function fakeKey(seed: string) {
  const presses: string[] = [];
  const okcrypto = {
    async deriveSecret(label: string, opts: any = {}) {
      if (opts.touch) presses.push(label);
      return sha256(Uint8Array.from(`${seed}|${opts.touch ? 'touch' : 'touchless'}|${label}`, c => c.charCodeAt(0)));
    },
  };
  return {okcrypto, presses};
}

test('a new entry is sealed with one press; its secrets leave the labels; opening takes one press', async () => {
  const k = fakeKey('A');
  const {entry, key} = await sealEntry({kind: 'login', title: 'Bank', username: 'u', password: 'secret-x', notes: 'n'}, k.okcrypto, ID);
  expect(entry.password).toBeUndefined();
  expect(entry.notes).toBeUndefined();
  expect(entry.username).toBe('u');
  expect(entry.inner.seal).toBe('entry-touch');
  expect(k.presses).toEqual([`okedge/passwords/v1/${ID}/${entry.inner.ref}`]);
  key.fill(0);
  const stored = {...entry, id: entry.inner.ref};
  const open = await openEntry(stored, k.okcrypto, ID);
  expect(open.entry.password).toBe('secret-x');
  expect(open.entry.notes).toBe('n');
  expect(k.presses.length).toBe(2);
});

test('an edit on the same visit seals again with the key of its open: no second press', async () => {
  const k = fakeKey('A');
  const first = await sealEntry({kind: 'login', title: 'Bank', password: 'one'}, k.okcrypto, ID);
  const stored = {...first.entry, id: first.entry.inner.ref};
  const open = await openEntry(stored, k.okcrypto, ID);
  const before = k.presses.length;
  const again = await sealEntry({...open.entry, password: 'two'}, k.okcrypto, ID, open.key);
  expect(k.presses.length).toBe(before);
  expect(again.entry.inner.ref).toBe(stored.id);
  expect((await openEntry({...again.entry, id: stored.id}, k.okcrypto, ID)).entry.password).toBe('two');
});

test('another key, or the seal of another entry, does not open it', async () => {
  const a = fakeKey('A');
  const x = await sealEntry({kind: 'login', title: 'Bank', password: 'b'}, a.okcrypto, ID);
  const y = await sealEntry({kind: 'login', title: 'Mail', password: 'm'}, a.okcrypto, ID);
  await expect(openEntry({...x.entry, id: x.entry.inner.ref}, fakeKey('B').okcrypto, ID)).rejects.toThrow(/does not open/);
  /* Mail's seal under Bank's id: its own key opens it, and it says it is not Bank's */
  const moved = {...x.entry, id: x.entry.inner.ref, inner: {...y.entry.inner}};
  moved.inner.ref = x.entry.inner.ref;
  await expect(openEntry(moved, a.okcrypto, ID)).rejects.toThrow();
});

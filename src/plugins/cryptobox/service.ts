import {bucketStorage} from '../../bucketStore';

import {store} from 'node-onlykey-lib/cryptobox';
import {currentNet} from '../../net';

/*
 * CRYPTOBOX'S STORAGE (its lib half: node-onlykey-lib/cryptobox - the store refuses anything but an
 * encrypted or signed PGP block). One list per net, as Guest Book's: the testnet's is its own.
 *
 * Kept in this identity's sealed bucket (plan S2, src/bucketStore.ts): store 'cryptobox', key as the lib names it
 * ('cryptobox:v1'). Only a key with no Edge identity still keeps it under its old plain name (storageKey).
 */

declare const crypto: {getRandomValues<T extends Uint8Array>(array: T): T};

const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));
const storageKey = () => (currentNet() === 'test' ? 'okrn.cryptobox.test:v1' : store.KEY);
const boxStorage = bucketStorage(
  () => (currentNet() === 'test' ? 'cryptobox-test' : 'cryptobox'),
  (k: string) => storageKey() + k.slice(store.KEY.length),
  [store.KEY],
);
export const openBox = () => store.createCryptobox({storage: boxStorage, randomBytes});

export type BoxMessage = {id: string; contact: string; dir: 'out' | 'in'; armored: string; kind: 'encrypted' | 'signed'; signed: boolean; at: string};

/* the thread id for messages to and from yourself (the recipients service's Me) */
export const ME = 'me';

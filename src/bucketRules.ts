/*
 * THE BUCKET'S STORE RULES IN THE APP - each feature's own merge (node-onlykey-lib bucket/src/rules.js), the same set the
 * CLI uses (bucket/cli/trade.js storeRules): one place, read by the phone's trade answers (src/bucketTrade.ts) and by
 * the Sync tab's per-feature summary (src/bucketStore.ts bucketSummary). A split store's parts (its items) come from
 * these rules.
 */
import * as bucketLib from 'node-onlykey-lib/bucket';

const keychain = require('node-onlykey-lib/keychain');

const kcRule = bucketLib.rules.keychain(keychain.list);
export const RULES = {
  keychain: kcRule, 'keychain-test': kcRule,
  guestbook: bucketLib.rules.guestbook(), 'guestbook-test': bucketLib.rules.guestbook(),
  passwords: bucketLib.rules.passwords(),
  cryptobox: bucketLib.rules.cryptobox(), 'cryptobox-test': bucketLib.rules.cryptobox(),
};

/** Per store, its items: a split store's entries / contacts / messages, another store's records. */
export function storeItems(bucket: {stores: Record<string, unknown>}): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [name, units] of Object.entries(bucketLib.replicate.summarize(bucket as any, {rules: RULES}) as Record<string, Record<string, unknown>>)) {
    /* the part for a split store's other fields (ending in \u0001) is not an item */
    const items = Object.keys(units).filter(k => !k.endsWith('\u0001')).length;
    if (items) out[name] = items;
  }
  return out;
}

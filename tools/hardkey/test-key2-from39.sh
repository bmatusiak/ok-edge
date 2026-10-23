#!/usr/bin/env bash
# ok-edge TODO A4: the tail of the kit on key 2 (the Edge developer build on libraries b273489, the testnet key) -
# 01-protocol 39-41 and the security section, in their own run. The full run reached file 39 and stopped on the
# kit's 45-minute section limit (Edge's tests and the wallet files' typed backups at keyboard speed), not on a failure.
source ~/.nvm/nvm.sh >/dev/null 2>&1
ROOT=~/project/onlykey
LOG=$ROOT/fw-edge/logs/key2-edge-from39-$(date +%Y%m%d-%H%M).log
cd $ROOT/onlykey-testing || exit 1
T=test/01-protocol
{
echo "== $(date -Is) kit $(git rev-parse --short HEAD): key 2, Edge build, from 01-protocol/39"
OKT_VENV=$ROOT/release-3.1.0-test/ok310 OKT_ALLOW_FIDO_RESET=yes \
  node bin/okt.js run $T/39-wallet-phrase-backup.test.js $T/39-wallet-phrase-record.test.js \
    $T/40-lib-xwing-decapsulate.test.js $T/41-lib-guestbook-swap.test.js 05-security --hardware --keep-going
echo "== $(date -Is) exit $?"
echo KEY2-EDGE-DONE
} > "$LOG" 2>&1
echo "== $(date -Is) key 2 Edge build: kit from 39 finished ($LOG)" >> $ROOT/steps.log

#!/usr/bin/env bash
# ok-edge TODO A4: the rest of the kit on key 2 (the Edge developer build), from where the first run
# stopped (01-protocol/37, the hard-key plugin gate) - Edge's own tests first, then 38-41 and the
# security section. Files 00-36 passed on this flash (fw-edge/logs/key2-edge-20261023-1202.log).
source ~/.nvm/nvm.sh >/dev/null 2>&1
ROOT=~/project/onlykey
LOG=$ROOT/fw-edge/logs/key2-edge-from37-$(date +%Y%m%d-%H%M).log
cd $ROOT/onlykey-testing || exit 1
T=test/01-protocol
{
echo "== $(date -Is) kit $(git rev-parse --short HEAD): key 2, Edge build, from 01-protocol/37"
OKT_VENV=$ROOT/release-3.1.0-test/ok310 OKT_ALLOW_FIDO_RESET=yes \
OKT_HARDKEY_PLUGINS=edge OKT_HARDKEY_PLUGINS_DIR=$ROOT/node-onlykey-emulator/emulator/plugins \
  node bin/okt.js run $T/37-hardkey-plugins.test.js $T/38-softkey-plugins.test.js $T/39-wallet-phrase-backup.test.js \
    $T/39-wallet-phrase-record.test.js $T/40-lib-xwing-decapsulate.test.js $T/41-lib-guestbook-swap.test.js 05-security \
    --hardware --keep-going
echo "== $(date -Is) exit $?"
echo KEY2-EDGE-DONE
} > "$LOG" 2>&1
echo "== $(date -Is) key 2 Edge build: kit from 37 finished ($LOG)" >> $ROOT/steps.log

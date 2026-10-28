#!/usr/bin/env bash
# The tail of the kit on key 2 (the Edge developer build): the lib section (07-lib - the wallet phrase files, X-Wing,
# the Guest Book swap; 01-protocol 39-41 until the kit split them out on 2026-10-28) and the security section, in their
# own run. They once followed Edge's tests in 01-protocol and ran into the kit's 45-minute section limit (the wallet
# files' typed backups at keyboard speed); as a section of their own they have a budget of their own.
source ~/.nvm/nvm.sh >/dev/null 2>&1
ROOT=~/project/onlykey
LOG=$ROOT/fw-edge/logs/key2-edge-from39-$(date +%Y%m%d-%H%M).log
cd $ROOT/onlykey-testing || exit 1
{
echo "== $(date -Is) kit $(git rev-parse --short HEAD): key 2, Edge build, 07-lib 05-security"
OKT_VENV=$ROOT/release-3.1.0-test/ok310 OKT_ALLOW_FIDO_RESET=yes \
  node bin/okt.js run 07-lib 05-security --hardware --keep-going
echo "== $(date -Is) exit $?"
echo KEY2-EDGE-DONE
} > "$LOG" 2>&1
echo "== $(date -Is) key 2 Edge build: kit 07-lib 05-security finished ($LOG)" >> $ROOT/steps.log

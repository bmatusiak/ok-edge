#!/usr/bin/env bash
# The rest of the kit on key 2 (the Edge developer build) after 01-protocol: the plugin section first (Edge's own
# tests through the hard-key plugin gate, 08-plugins), then the lib section (07-lib) and the security section. These
# were 01-protocol 37-41 until the kit split them into sections of their own (2026-10-28); the name keeps the old
# file number so the logs that cite it still find it.
source ~/.nvm/nvm.sh >/dev/null 2>&1
ROOT=~/project/onlykey
LOG=$ROOT/fw-edge/logs/key2-edge-from37-$(date +%Y%m%d-%H%M).log
cd $ROOT/onlykey-testing || exit 1
{
echo "== $(date -Is) kit $(git rev-parse --short HEAD): key 2, Edge build, 08-plugins 07-lib 05-security"
OKT_VENV=$ROOT/release-3.1.0-test/ok310 OKT_ALLOW_FIDO_RESET=yes \
OKT_HARDKEY_PLUGINS=edge OKT_HARDKEY_PLUGINS_DIR=$ROOT/node-onlykey-emulator/emulator/plugins \
  node bin/okt.js run 08-plugins 07-lib 05-security --hardware --keep-going
echo "== $(date -Is) exit $?"
echo KEY2-EDGE-DONE
} > "$LOG" 2>&1
echo "== $(date -Is) key 2 Edge build: kit 08-plugins 07-lib 05-security finished ($LOG)" >> $ROOT/steps.log

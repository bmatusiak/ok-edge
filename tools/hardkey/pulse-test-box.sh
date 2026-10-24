#!/usr/bin/env bash
# The Edge press pulse (fadeon 43 at the wait, fadeoff 85 / 1 at the end): the soft key's Edge
# suite on the Linux emulator, then the developer hard key's image rebuilt. Run on the box.
source ~/.nvm/nvm.sh >/dev/null 2>&1
ROOT=~/project/onlykey
step() { echo "== $(date +%H:%M:%S) $*"; }

step "1. emulator v3.1.0 + fixes + edge (DEBUG)"
cd $ROOT/node-onlykey-emulator/emulator || exit 1
OKEMU_VERSION=v3.1.0 OKEMU_DEBUG=1 OKEMU_PLUGINS=edge npm run rebuild > $ROOT/fw-edge/logs/pulse-emu-build.log 2>&1
rc=$?; tail -3 $ROOT/fw-edge/logs/pulse-emu-build.log; [ $rc = 0 ] || { echo "PULSE-STOPPED: emulator build exit $rc"; exit 1; }
grep -o '"plugins"[^]]*]' .stage/build.json

step "2. kit: the soft-key plugin suite (Edge's own tests)"
cd $ROOT/onlykey-testing || exit 1
node bin/okt.js run 38-softkey-plugins --keep-going 2>&1 | tail -25

step "3. the hard key's image"
cd $ROOT/node-onlykey-emulator/emulator/plugins/edge || exit 1
bash tools/build-hardkey.sh 2>&1 | tail -6
step "PULSE-DONE"

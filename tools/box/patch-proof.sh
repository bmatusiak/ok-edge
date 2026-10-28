#!/usr/bin/env bash
# THE PROOF A PATCH GOES OUT WITH (Brad, 2026-10-28: "Tim should get the test that fails before the patch, and it
# should pass after the patch"): the patches' own tests (the kit's 09-patches, each patch's tests/kit.test.js) on two
# soft keys built from the same emulator commit -
#   released   3.1.0 as the maintainer published it (OKEMU_RC_FIXES=0): every named patch's test must FAIL
#   patched    the same with the patches staged (the default): every one must PASS
# Both DEBUG, as the kit drives them. Run on the box, detached, with a window that tails the log:
#   setsid nohup bash tools/box/patch-proof.sh [<emulator repo>] [patches, e.g. 0013,0015 - default all] > proof.log 2>&1 &
# <emulator repo> (default ~/project/onlykey/node-onlykey-emulator) is copied twice into ~/project/onlykey/patch-proof,
# so its own build is not touched; the kit and the lib are the ones beside it.
source ~/.nvm/nvm.sh >/dev/null 2>&1
P=~/project/onlykey
SRC=${1:-$P/node-onlykey-emulator}
PATCHES=${2:-all}
W=$P/patch-proof
K=$P/onlykey-testing
LIB=$P/node-onlykey-lib
mkdir -p "$W"
say() { echo "== $(date +%T) $*"; }

build() {   # build <name> <RC fixes 0|1>
  local d=$W/$1
  rm -rf "$d"; mkdir -p "$d"
  git clone -q "$SRC" "$d/node-onlykey-emulator"
  cp -a "$SRC/emulator/node_modules" "$d/node-onlykey-emulator/emulator/"
  for s in OnlyKey-Firmware libraries arduino-1.6.5-r5-teensy_127; do ln -s "$P/$s" "$d/$s"; done
  say "build $1 (OKEMU_RC_FIXES=$2) at $(git -C "$d/node-onlykey-emulator" rev-parse --short HEAD)"
  (cd "$d/node-onlykey-emulator/emulator" && OKEMU_VERSION=v3.1.0 OKEMU_RC_FIXES=$2 OKEMU_DEBUG=1 JOBS=max npm run rebuild > "$W/build-$1.log" 2>&1) \
    || { say "build $1 FAILED - $W/build-$1.log"; exit 1; }
  say "built $1: fixes $(jq -c .fixes "$d/node-onlykey-emulator/emulator/.stage/build.json")"
}

kit() {     # kit <name> - the patches' tests on that build; its OKT-END line
  local log=$W/kit-$1.log
  (cd "$K" && OKEMU_ROOT=$W/$1/node-onlykey-emulator/emulator OKT_PATCHES=$PATCHES OKT_LIB_DIR=$LIB \
    node bin/okt.js run 09-patches --keep-going > "$log" 2>&1)
  grep -a 'OKT-END' "$log" | tail -1
  grep -aE '^\S+ +(ok|FAIL) ' "$log" | cut -c26-170
}

build released 0
build patched 1
say "the patches' tests on 3.1.0 AS RELEASED - each must FAIL (that is the bug, shown)"
kit released
say "the patches' tests WITH THE PATCHES - each must PASS"
kit patched
r=$(grep -a 'OKT-END' "$W/kit-released.log" | tail -1 | sed -nE 's/.*tests=([0-9]+)p\/([0-9]+)f.*/\1 \2/p')
p=$(grep -a 'OKT-END' "$W/kit-patched.log" | tail -1 | sed -nE 's/.*tests=([0-9]+)p\/([0-9]+)f.*/\1 \2/p')
if [ "${r% *}" = 0 ] && [ "${r#* }" -gt 0 ] && [ "${p#* }" = 0 ] && [ "${p% *}" -gt 0 ]; then
  say "PATCH-PROOF: OK - released ${r#* } failed / 0 passed, patched ${p% *} passed / 0 failed"
else
  say "PATCH-PROOF: NOT SHOWN - released ${r% *} passed / ${r#* } failed, patched ${p% *} passed / ${p#* } failed"
fi

#!/usr/bin/env bash
# THE PROOF FOR PATCH 0018 (a second-profile PIN added in config mode keeps the primary profile's key): its test - the
# kit test in the patch's tests/ folder - run as its own header says, against two soft keys built from one emulator
# commit, in the kit's own emulated adapter (no USB gadget, so the box's gadget soft key is not touched):
#   released   3.1.0 as the maintainer published it (no version_control plugin) - the test must FAIL
#   p0018      3.1.0 + patch 0018 alone (a version_control listing only it) - the test must PASS
# Both DEBUG (the PIN steps wait on the firmware's console lines). Every step's output stays in
# ~/project/onlykey/second-pin-proof.
#   setsid nohup bash tools/box/second-pin-proof.sh > ~/project/onlykey/second-pin-proof/proof.log 2>&1 &
source ~/.nvm/nvm.sh >/dev/null 2>&1
P=~/project/onlykey
SRC=${1:-$P/node-onlykey-emulator}
W=$P/second-pin-proof
K=$P/onlykey-testing
PATCHDIR=emulator/scripts/versions/patches-3.1.0
NAME=0018-libraries-okcore-second-pin-keeps-primary-profile-key
TEST=$SRC/$PATCHDIR/$NAME/tests/second-pin-keeps-primary-keys.test.js
mkdir -p "$W"
say() { echo "== $(date +%T) $*"; }
[ -f "$TEST" ] || { say "no test at $TEST"; exit 1; }

build() {   # build <name>: released | p0018
  local d=$W/$1
  rm -rf "$d"; mkdir -p "$d"
  git clone -q "$SRC" "$d/node-onlykey-emulator"
  cp -a "$SRC/emulator/node_modules" "$d/node-onlykey-emulator/emulator/"
  for s in OnlyKey-Firmware libraries arduino-1.6.5-r5-teensy_127; do ln -s "$P/$s" "$d/$s"; done
  local E=$d/node-onlykey-emulator/emulator pl=
  if [ "$1" = p0018 ]; then
    # 0018 alone: the others' folders gone, the staged list regenerated, a version_control release listing only it
    pl=version_control
    printf '{"base": "3.1.0", "build": 1, "patches": ["0018"]}\n' > "$E/plugins/version_control/version.json"
    (cd "$d/node-onlykey-emulator/$PATCHDIR" && for f in 00*; do case $f in 0018-*) ;; *) rm -rf "$f" ;; esac; done)
    (cd "$E" && node scripts/versions/gen-fixes.js 3.1.0 >/dev/null) || { say "gen-fixes failed"; exit 1; }
  fi
  say "build $1 at $(git -C "$d/node-onlykey-emulator" rev-parse --short HEAD)"
  (cd "$E" && OKEMU_VERSION=v3.1.0 OKEMU_PLUGINS=$pl OKEMU_DEBUG=1 JOBS=max npm run rebuild > "$W/build-$1.log" 2>&1) \
    || { say "build $1 FAILED - $W/build-$1.log"; exit 1; }
  say "built $1: fixes $(jq -c .fixes "$E/.stage/build.json"), debug $(jq -c .debug "$E/.stage/build.json")"
}

prove() {   # prove <name>: the test on that build, as its header says to run it
  local E=$W/$1/node-onlykey-emulator/emulator log=$W/test-$1.log
  say "$1: the test"
  (cd "$K" && OKEMU_ROOT=$E node bin/okt.js run "$TEST") > "$log" 2>&1
  local rc=$?
  sed 's/^/   /' "$log" | tail -25
  say "$1: test exit $rc"
  return $rc
}

build released
build p0018
prove released; r=$?
prove p0018; p=$?
if [ $r != 0 ] && [ $p = 0 ]; then say "SECOND-PIN-PROOF: OK - 3.1.0 as released FAILS, with 0018 PASSES"
else say "SECOND-PIN-PROOF: NOT SHOWN - released exit $r (want non-zero), p0018 exit $p (want 0)"; fi

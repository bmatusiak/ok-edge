#!/usr/bin/env bash
# THE PROOF FOR PATCH 0014 (X25519 clamping): its test - python-onlykey's x25519_check.py, the RFC 7748 vector - run
# exactly as its own instructions tell a person to, against two soft keys built from one emulator commit and presented
# as real OnlyKeys on USB (the emulator's gadget):
#   released   3.1.0 as the maintainer published it (OKEMU_RC_FIXES=0)          - the test must say FAIL
#   p0014      3.1.0 + patch 0014 alone (the only patch folder kept, HOLD off)  - the test must say PASS
# Both DEBUG (the presses go through the debug console). Every step's output stays in ~/project/onlykey/x25519-proof.
#   setsid nohup bash tools/box/x25519-proof.sh > ~/project/onlykey/x25519-proof/proof.log 2>&1 &
# Never with a hard key on the box's USB: python-onlykey talks to the first OnlyKey it finds, and the test overwrites
# ECC slots 101-103. The script refuses to start when one is there.
source ~/.nvm/nvm.sh >/dev/null 2>&1
P=~/project/onlykey
SRC=${1:-$P/node-onlykey-emulator}
W=$P/x25519-proof
K=$P/onlykey-testing
PY=$P/release-3.1.0-test/ok310/bin
PATCHDIR=emulator/scripts/versions/patches-3.1.0
TEST=$SRC/$PATCHDIR/0014-libraries-okcrypto-x25519-clamp/tests/x25519_check.py
PIN="1 1 1 1 1 1 1"
mkdir -p "$W"
say() { echo "== $(date +%T) $*"; }
onlykeys() { lsusb -d 1d50:60fc 2>/dev/null | wc -l; }

[ "$(onlykeys)" = 0 ] || { say "an OnlyKey is already on USB - unplug it (the test overwrites ECC slots 101-103)"; exit 1; }
[ -f "$TEST" ] || { say "no test at $TEST"; exit 1; }

build() {   # build <name>: released | p0014
  local d=$W/$1
  rm -rf "$d"; mkdir -p "$d"
  git clone -q "$SRC" "$d/node-onlykey-emulator"
  cp -a "$SRC/emulator/node_modules" "$d/node-onlykey-emulator/emulator/"
  for s in OnlyKey-Firmware libraries arduino-1.6.5-r5-teensy_127; do ln -s "$P/$s" "$d/$s"; done
  local E=$d/node-onlykey-emulator/emulator rc=1
  if [ "$1" = released ]; then
    rc=0
  else
    # 0014 alone: the other patch folders out, its HOLD off, the staged list regenerated from what is left
    (cd "$d/node-onlykey-emulator/$PATCHDIR" && for f in 00*; do case $f in 0014-*) rm -f "$f/HOLD" ;; *) rm -rf "$f" ;; esac; done)
    (cd "$d/node-onlykey-emulator/emulator" && node scripts/versions/gen-fixes.js 3.1.0 >/dev/null) || { say "gen-fixes failed"; exit 1; }
  fi
  say "build $1 at $(git -C "$d/node-onlykey-emulator" rev-parse --short HEAD)"
  (cd "$E" && OKEMU_VERSION=v3.1.0 OKEMU_RC_FIXES=$rc OKEMU_DEBUG=1 JOBS=max npm run rebuild > "$W/build-$1.log" 2>&1) \
    || { say "build $1 FAILED - $W/build-$1.log"; exit 1; }
  say "built $1: fixes $(jq -c .fixes "$E/.stage/build.json"), debug $(jq -c .debug "$E/.stage/build.json")"
}

prove() {   # prove <name>: the test on that build, as a person runs it
  local E=$W/$1/node-onlykey-emulator/emulator S=$W/$1-storage log=$W/test-$1.log daemon=
  # the firmware's CPU_RESTART() exits the emulator process (config mode is entered through one): a loop respawns it,
  # as pm2 does for the gadget soft key, so the key comes back the way a hard key does after its restart
  start() {
    (cd "$E" && while :; do node bin/daemon.js --storage "$S" --quiet >> "$W/daemon-$1.log" 2>&1; sleep 0.5; done) &
    daemon=$!
    usb_back
  }
  usb_back() {
    for _ in $(seq 60); do [ "$(onlykeys)" = 1 ] && break; sleep 0.5; done
    [ "$(onlykeys)" = 1 ] || { say "the soft key did not appear on USB"; stop; exit 1; }
    sleep 3
  }
  stop() {
    pkill -P "$daemon" 2>/dev/null; kill "$daemon" 2>/dev/null; wait "$daemon" 2>/dev/null
    for _ in $(seq 40); do [ "$(onlykeys)" = 0 ] && break; sleep 0.25; done
  }
  press() { (cd "$E" && timeout 30 node bin/press.js "$@" >> "$W/press-$1.log" 2>&1); sleep 1; }

  say "$1: a key with its PIN set (the kit's 'initialized' state)"
  local fx
  fx=$(cd "$K" && OKEMU_ROOT=$E node bin/okt.js fixture initialized 2>&1 | sed -nE 's/^initialized: .* at (.*)$/\1/p')
  [ -n "$fx" ] || { say "no fixture"; exit 1; }
  rm -rf "$S"; mkdir -p "$S"; cp "$fx/flash.bin" "$fx/eeprom.bin" "$S/"

  start
  say "$1: unlock, then config mode (hold 6, the PIN again), then the three keys - the test's step 1"
  # as the kit does it (lib/device enterConfigMode): unlocked and settled, a long press of 6 restarts the key locked;
  # the PIN again then opens it in config mode
  press $PIN; sleep 3; press 6:hold
  sleep 2; usb_back
  press $PIN; sleep 2
  for k in "ECC1 c d 2a2cb91da5fb77b12a99c0eb872f4cdf4566b25172c1163c7da518730a6d0777" \
           "ECC2 c d 77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a" \
           "ECC3 c d 6a2cb91da5fb77b12a99c0eb872f4cdf4566b25172c1163c7da518730a6d0770"; do
    # shellcheck disable=SC2086
    "$PY/onlykey-cli" setkey $k 2>&1 | tail -1 | sed "s/^/   setkey ${k%% *}: /"
  done
  say "$1: replug, unlock, run the test - step 2 (each code it shows is entered on the key)"
  stop; start
  press $PIN
  "$PY/python3" -u "$TEST" > "$log" 2>&1 &
  local tpid=$! seen=0
  for _ in $(seq 240); do
    kill -0 $tpid 2>/dev/null || break
    local n
    n=$(grep -c "^  enter " "$log")
    if [ "$n" -gt "$seen" ]; then
      seen=$n
      # shellcheck disable=SC2046
      press $(grep "^  enter " "$log" | tail -1 | sed -E 's/^  enter (.*) on the OnlyKey$/\1/' | grep -o '[1-6]')
    fi
    sleep 0.5
  done
  wait $tpid; local rc=$?
  stop
  sed 's/^/   /' "$log"
  say "$1: test exit $rc"
  return $rc
}

build released
build p0014
prove released; r=$?
prove p0014; p=$?
if [ $r = 1 ] && [ $p = 0 ]; then say "X25519-PROOF: OK - 3.1.0 as released FAILS, with 0014 PASSES"
else say "X25519-PROOF: NOT SHOWN - released exit $r (want 1), p0014 exit $p (want 0)"; fi

#!/usr/bin/env bash
# THE RELEASE GATE'S ONE FAILURE, UNDER THREADSANITIZER (after asan-restore.sh came back clean).
#
# The soft key segfaulted once in 01-protocol/10-backup-restore, right after the restore decrypted the FIDO2 auth
# state, with the same bytes as the runs that passed; AddressSanitizer found no bad access in the same file. What is
# left for a same-input, sometimes-crash is two threads touching the same memory: the firmware thread, SysTick, and
# the host's thread feeding HID reports and presses (src/ok_hal.cpp). Brad has also seen the soft key's LED flicker,
# the same kind of symptom. ThreadSanitizer reports such a race whenever both touches happen, crash or not.
#
#   bash tools/box/tsan-restore.sh [<emulator dir>] [runs]
#
# Same build as asan-restore.sh (the rehearsal's scratch emulator copy, staged as the gate stages it: v3.1.0 recipe,
# the hex's plugins, DEBUG), compiled with -fsanitize=thread; node itself is not instrumented, so only the addon's
# accesses are tracked - which is where the firmware runs. setarch -R: TSan's shadow memory needs a fixed layout.
source ~/.nvm/nvm.sh >/dev/null 2>&1
H=$(ls -d ~/.cache/act/*/hostexecutor 2>/dev/null | head -1)
EMU_REPO=${1:-$H/node-onlykey-emulator}
RUNS=${2:-2}
E=$EMU_REPO/emulator
K=$(dirname "$EMU_REPO")/onlykey-testing
LIB=$(dirname "$EMU_REPO")/node-onlykey-lib
OUT=~/project/onlykey/release-rehearse/tsan-restore; mkdir -p "$OUT"
TSAN_LIB=$(g++ -print-file-name=libtsan.so)
[ -d "$E" ] && [ -d "$K" ] || { echo "no emulator at $E or kit at $K"; exit 1; }
[ -f "$TSAN_LIB" ] || { echo "no libtsan ($TSAN_LIB)"; exit 1; }
export OKEMU_VERSION=v3.1.0 OKEMU_DEBUG=1 OKEMU_PLUGINS=edge,ctap_bridge,derive_secret,version_control
cd "$E" || exit 1
rm -rf .stage-src/v3.1.0
node scripts/stage.js > "$OUT/stage.log" 2>&1 || { echo "stage failed (see $OUT/stage.log)"; exit 1; }
node scripts/gen-sources.js > /dev/null 2>&1
export CFLAGS="-fsanitize=thread -fno-omit-frame-pointer -g" CXXFLAGS="-fsanitize=thread -fno-omit-frame-pointer -g" LDFLAGS="-fsanitize=thread"
npx node-gyp configure -Dnode_with_ltcg=false > "$OUT/configure.log" 2>&1 && JOBS=max npx node-gyp build > "$OUT/build.log" 2>&1
echo "build exit $? ($(nm -u build/Release/onlykey_emulator.node | grep -c __tsan_) tsan symbols)"
unset CFLAGS CXXFLAGS LDFLAGS
rm -f /tmp/tsan-restore.*
cd "$K" || exit 1
for i in $(seq 1 "$RUNS"); do
  TSAN_OPTIONS=halt_on_error=0:report_signal_unsafe=0:history_size=4:log_path=/tmp/tsan-restore LD_PRELOAD=$TSAN_LIB OKT_LIB_DIR=$LIB \
    setarch "$(uname -m)" -R timeout 2400 node bin/okt.js run test/01-protocol/10-backup-restore.test.js > "$OUT/kit-$i.log" 2>&1
  echo "run $i: $(grep -a -o 'tests=[^ ]*' "$OUT/kit-$i.log" | tail -1) $(grep -a -o 'DEVICE FATAL.*' "$OUT/kit-$i.log" | head -1 | cut -c1-80); reports so far: $(cat /tmp/tsan-restore.* 2>/dev/null | grep -c 'WARNING: ThreadSanitizer')"
done
cp /tmp/tsan-restore.* "$OUT/" 2>/dev/null
echo "== TSan reports by kind and the first frame of each side:"
cat /tmp/tsan-restore.* 2>/dev/null | awk '/WARNING: ThreadSanitizer/{kind=$3" "$4; n=0} /^    #0 /{n++; f[n]=$2" "$3} /^  (Previous|Location)/{} /^SUMMARY/{print kind, "|", f[1], "|", f[2]}' | sort | uniq -c | sort -rn | head -20
echo "== SUMMARY lines:"
cat /tmp/tsan-restore.* 2>/dev/null | grep -a "^SUMMARY" | sort | uniq -c | sort -rn | head -20
echo TSAN-RESTORE-DONE

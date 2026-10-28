#!/usr/bin/env bash
# THE RELEASE GATE'S ONE FAILURE, UNDER ADDRESSSANITIZER (the pattern: release-3.1.0-test/asan-f9.sh on the box).
#
# The gate (.github/workflows/release.yml) failed once in 01-protocol/10-backup-restore: the soft key segfaulted
# right after the restore decrypted the FIDO2 auth state - the same bytes, the same nonce and IV as the runs that
# passed (6 of 7). Same inputs, a crash only sometimes: a memory error. ASan reports one on every run that touches
# it, crash or not, with the place and the variable.
#
#   bash tools/box/asan-restore.sh [<emulator dir>] [runs]
#
# <emulator dir>: a node-onlykey-emulator checkout to REBUILD with ASan (default: the rehearsal's scratch copy under
# act's workspace - never the box's own clone, which the Pixel builds and the kit use). Staged exactly as the gate
# stages it: the v3.1.0 recipe (its fixes), the hex's plugins, DEBUG on. The kit beside it runs the file <runs> times.
# Reports and the per-place tally land in $OUT.
source ~/.nvm/nvm.sh >/dev/null 2>&1
H=$(ls -d ~/.cache/act/*/hostexecutor 2>/dev/null | head -1)
EMU_REPO=${1:-$H/node-onlykey-emulator}
RUNS=${2:-3}
E=$EMU_REPO/emulator
K=$(dirname "$EMU_REPO")/onlykey-testing
LIB=$(dirname "$EMU_REPO")/node-onlykey-lib
OUT=~/project/onlykey/release-rehearse/asan-restore; mkdir -p "$OUT"
ASAN_LIB=$(g++ -print-file-name=libasan.so)
[ -d "$E" ] && [ -d "$K" ] || { echo "no emulator at $E or kit at $K"; exit 1; }
export OKEMU_VERSION=v3.1.0 OKEMU_DEBUG=1 OKEMU_PLUGINS=edge,ctap_bridge,derive_secret
cd "$E" || exit 1
rm -rf .stage-src/v3.1.0
node scripts/stage.js > "$OUT/stage.log" 2>&1 || { echo "stage failed (see $OUT/stage.log)"; exit 1; }
grep -a -E "fixes|plugins" "$OUT/stage.log" | head -4
node scripts/gen-sources.js > /dev/null 2>&1
export CFLAGS="-fsanitize=address -fsanitize-recover=address -fno-omit-frame-pointer" CXXFLAGS="-fsanitize=address -fsanitize-recover=address -fno-omit-frame-pointer" LDFLAGS="-fsanitize=address -fsanitize-recover=address"
npx node-gyp configure -Dnode_with_ltcg=false > "$OUT/configure.log" 2>&1 && JOBS=max npx node-gyp build > "$OUT/build.log" 2>&1
echo "build exit $? ($(nm -u build/Release/onlykey_emulator.node | grep -c __asan_) asan symbols)"
unset CFLAGS CXXFLAGS LDFLAGS
rm -f /tmp/asan-restore.*
cd "$K" || exit 1
for i in $(seq 1 "$RUNS"); do
  ASAN_OPTIONS=detect_leaks=0:halt_on_error=0:log_path=/tmp/asan-restore LD_PRELOAD=$ASAN_LIB OKT_LIB_DIR=$LIB \
    timeout 900 node bin/okt.js run test/01-protocol/10-backup-restore.test.js > "$OUT/kit-$i.log" 2>&1
  echo "run $i: $(grep -a -o 'tests=[^ ]*' "$OUT/kit-$i.log" | tail -1) $(grep -a -o 'DEVICE FATAL.*' "$OUT/kit-$i.log" | head -1 | cut -c1-80); reports so far: $(ls /tmp/asan-restore.* 2>/dev/null | wc -l)"
done
cp /tmp/asan-restore.* "$OUT/" 2>/dev/null
echo "== ASan reports by kind and place:"
cat /tmp/asan-restore.* 2>/dev/null | awk '/ERROR: AddressSanitizer/{kind=$3; getline; acc=$1" "$2" "$4; getline; f0=$4; getline; f1=$4; print kind, acc, "in", f0, "<-", f1}' | sort | uniq -c
echo "== the variable each report names:"
cat /tmp/asan-restore.* 2>/dev/null | grep -a "is located" | sed 's/0x[0-9a-f]*//g' | sort | uniq -c | head
echo ASAN-RESTORE-DONE

#!/usr/bin/env bash
# CATCH THE RELEASE GATE'S SEGFAULT IN A CORE DUMP (the gate: .github/workflows/release.yml, tools/box/gate-run.sh).
#
# About one full gate run in four, the soft key dies in 01-protocol/10-backup-restore as the restore ends with a
# restart - by SIGSEGV instead of the host's own SIGKILL, and with NOTHING on stderr: the emulator's segfault handler
# (src/okemu_restart.cpp), which prints the address and a backtrace, never ran. Alone the file never fails (11 runs,
# plain, ASan and TSan builds). So the only witness is the dead process itself: its core, every thread's stack.
#
#   bash tools/box/catch-crash.sh [<emulator dir>] [tries]
#
# 1. a plain gate build of <emulator dir> (v3.1.0 recipe, the hex's plugins, DEBUG) WITH -g: debug info only, the
#    same code, so the stacks carry file and line;
# 2. cores kept: apport (this box's core_pattern) is told to keep crashes of programs that are not distro packages
#    (~/.config/apport/settings: [main] unpackaged=true - this user only, undone by deleting the line), ulimit -c;
# 3. the kit up to the crash point - 00-sanity and 01-protocol 00..10 - up to <tries> times, stopping at the first
#    segfault;
# 4. the newest node crash report unpacked and every thread's backtrace printed (gdb).
source ~/.nvm/nvm.sh >/dev/null 2>&1
H=$(ls -d ~/.cache/act/*/hostexecutor 2>/dev/null | head -1)
EMU_REPO=${1:-$H/node-onlykey-emulator}
TRIES=${2:-12}
E=$EMU_REPO/emulator
K=$(dirname "$EMU_REPO")/onlykey-testing
LIB=$(dirname "$EMU_REPO")/node-onlykey-lib
OUT=~/project/onlykey/release-rehearse/catch-crash; rm -rf "$OUT"; mkdir -p "$OUT"
[ -d "$E" ] && [ -d "$K" ] && [ -d "$LIB" ] || { echo "no emulator at $E, kit at $K or lib at $LIB"; exit 1; }

mkdir -p ~/.config/apport
grep -q '^unpackaged=true' ~/.config/apport/settings 2>/dev/null || printf '[main]\nunpackaged=true\n' >> ~/.config/apport/settings
ulimit -c unlimited
echo "== cores: core_pattern $(cut -c1-40 /proc/sys/kernel/core_pattern)... ulimit -c $(ulimit -c), apport unpackaged=true"

cd "$E" || exit 1
rm -rf .stage-src/v3.1.0
echo "== build (plain + -g): v3.1.0, edge,ctap_bridge,derive_secret, DEBUG"
CFLAGS="-g" CXXFLAGS="-g" OKEMU_VERSION=v3.1.0 OKEMU_PLUGINS=edge,ctap_bridge,derive_secret OKEMU_DEBUG=1 JOBS=max npm run rebuild > "$OUT/build.log" 2>&1
echo "build exit $? (debug info: $(readelf -S build/Release/onlykey_emulator.node 2>/dev/null | grep -c debug_info) section)"
NODE_ADDON="$E/build/Release/onlykey_emulator.node"

cd "$K" || exit 1
files="00-sanity"
for f in test/01-protocol/0[0-9]-*.test.js test/01-protocol/10-*.test.js; do files="$files $f"; done
before=$(ls /var/crash/*node*.crash 2>/dev/null | wc -l)
caught=""
for i in $(seq 1 "$TRIES"); do
  OKT_LIB_DIR=$LIB node bin/okt.js run $files > "$OUT/kit-$i.log" 2>&1
  END=$(grep -a 'OKT-END' "$OUT/kit-$i.log" | tail -1)
  echo "try $i: $(echo "$END" | grep -o 'tests=[^ ]*') $(grep -a -o 'DEVICE FATAL.*' "$OUT/kit-$i.log" | head -1 | cut -c1-80)"
  if grep -aq 'segfaulted' "$OUT/kit-$i.log"; then caught=$i; break; fi
done
[ -n "$caught" ] || { echo "CATCH-CRASH-DONE: no crash in $TRIES tries"; exit 0; }

sleep 5   # apport writes the report after the process is gone
crash=$(ls -t /var/crash/*node*.crash 2>/dev/null | head -1)
echo "== crash report: ${crash:-none} ($(ls /var/crash/*node*.crash 2>/dev/null | wc -l) node reports, $before before)"
[ -n "$crash" ] || { echo "CATCH-CRASH-DONE: crashed on try $caught but apport kept no report"; exit 1; }
rm -rf "$OUT/unpacked"; apport-unpack "$crash" "$OUT/unpacked" >/dev/null 2>&1
ls -la "$OUT/unpacked/CoreDump" 2>/dev/null | awk '{print "core:", $5, "bytes"}'
echo "== every thread at the crash (gdb):"
gdb -q -batch -ex "set pagination off" -ex "info sharedlibrary onlykey" -ex "thread apply all bt 25" "$(command -v node)" "$OUT/unpacked/CoreDump" > "$OUT/gdb.txt" 2>&1
grep -E "^Thread |^#|signal|SIG" "$OUT/gdb.txt" | head -120
echo "CATCH-CRASH-DONE: crashed on try $caught - full gdb output in $OUT/gdb.txt"

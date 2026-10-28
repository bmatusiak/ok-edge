#!/usr/bin/env bash
# THE RELEASE WORKFLOW'S TEST GATE, OUTSIDE THE WORKFLOW (.github/workflows/release.yml, job "gate"), on the box.
#
#   bash tools/box/gate-run.sh [<emulator dir>] [runs]
#   setsid nohup bash tools/box/gate-run.sh ... > gate.log 2>&1 &   (and a window that only tails gate.log: closing a
#                                                                    window then ends nothing - a run started IN a window
#                                                                    died with it once, silently, mid-file)
#
# The gate's steps exactly: a PLAIN build (no sanitizer) of <emulator dir> staged as the gate stages it - the v3.1.0
# recipe (its fixes), the hex's plugins, DEBUG on - then the kit's 00-sanity, 01-protocol, 07-lib and 08-plugins against the lib ok-edge
# pins (OKT_LIB_DIR), with the gate's no-false-green checks (crypto available, skips <= 20). Run <runs> times, to see
# whether a failure is steady or now and then. Default <emulator dir>: the rehearsal's scratch copy under act's
# workspace, which has the kit and the lib beside it.
source ~/.nvm/nvm.sh >/dev/null 2>&1
H=$(ls -d ~/.cache/act/*/hostexecutor 2>/dev/null | head -1)
EMU_REPO=${1:-$H/node-onlykey-emulator}
RUNS=${2:-1}
E=$EMU_REPO/emulator
K=$(dirname "$EMU_REPO")/onlykey-testing
LIB=$(dirname "$EMU_REPO")/node-onlykey-lib
OUT=~/project/onlykey/release-rehearse/gate-run; mkdir -p "$OUT"
[ -d "$E" ] && [ -d "$K" ] && [ -d "$LIB" ] || { echo "no emulator at $E, kit at $K or lib at $LIB"; exit 1; }
[ "$(sysctl -n vm.mmap_min_addr)" -le 4096 ] || { echo "vm.mmap_min_addr is above 4096 - the emulator cannot map its flash"; exit 1; }
cd "$E" || exit 1
# NO_BUILD=1: the soft key <emulator dir> already holds, as built by an earlier run of this script (the build is minutes)
if [ -n "$NO_BUILD" ]; then
  echo "== no build (NO_BUILD): the soft key already in $E/build - $(jq -r '.version + " " + (.plugins | join(",")) + " debug=" + (.debug | tostring)' .stage/build.json 2>/dev/null)"
else
rm -rf .stage-src/v3.1.0
echo "== build (plain): v3.1.0, edge,ctap_bridge,derive_secret, DEBUG"
OKEMU_VERSION=v3.1.0 OKEMU_PLUGINS=edge,ctap_bridge,derive_secret OKEMU_DEBUG=1 JOBS=max npm run rebuild > "$OUT/build.log" 2>&1
echo "build exit $? (sanitizer symbols: $(nm -u build/Release/onlykey_emulator.node | grep -c -E '__(a|t)san_'), must be 0)"
fi
cd "$K" || exit 1
# the kit finds its emulator beside its OWN folder (lib/paths.js), which is not <emulator dir> when the kit is a
# symlink - name it, or the kit tests whatever emulator build sits beside the real kit
export OKEMU_ROOT=$E
pass=0
for i in $(seq 1 "$RUNS"); do
  echo "== run $i: 00-sanity 01-protocol 07-lib 08-plugins"
  LOG=$OUT/kit-$i.log
  OKT_LIB_DIR=$LIB node bin/okt.js run 00-sanity 01-protocol 07-lib 08-plugins > "$LOG" 2>&1 &
  kit=$!
  # NEVER SILENT (Brad, 2026-10-28: "these tests should never go silent"): a line a minute while the kit runs - the
  # file it is in, how many passed, how long since its last output (SILENT past 5 minutes) - so a stall or a death shows
  while kill -0 "$kit" 2>/dev/null; do
    for _ in $(seq 60); do kill -0 "$kit" 2>/dev/null || break; sleep 1; done
    kill -0 "$kit" 2>/dev/null || break
    age=$(( $(date +%s) - $(stat -c %Y "$LOG") ))
    state=running; [ "$age" -ge 300 ] && state=SILENT
    # the serial kit names the file it is in ("--- <file>"); the parallel one says a line a minute itself ("[okt] ...")
    where=$(grep -aE '^\[okt\] |^--- [0-9]' "$LOG" | tail -1 | sed 's/^--- //' | cut -c1-150)
    echo "   $(date +%T) $state: $where, $(grep -ac '     ok ' "$LOG") ok, last output ${age}s ago"
  done
  wait "$kit"
  code=$?
  [ "$code" -gt 128 ] && echo "   the kit was KILLED by signal $((code - 128)) - last output: $(tail -1 "$LOG" | cut -c1-120)"
  [ "$code" -gt 128 ] || echo "   the kit ended, exit $code"
  END=$(grep -a 'OKT-END' "$OUT/kit-$i.log" | tail -1)
  SKIPS=$(echo "$END" | sed -nE 's/.*tests=[0-9]+p\/[0-9]+f\/([0-9]+)s.*/\1/p')
  crypto=$(grep -aqE 'yes crypto$' "$OUT/kit-$i.log" && echo yes || echo NO)
  verdict=FAIL
  [ $code = 0 ] && [ "$crypto" = yes ] && [ -n "$SKIPS" ] && [ "$SKIPS" -le 20 ] && { verdict=PASS; pass=$((pass + 1)); }
  echo "run $i: $verdict - $(echo "$END" | grep -o 'tests=[^ ]*') crypto=$crypto $(grep -a -o 'DEVICE FATAL.*' "$OUT/kit-$i.log" | head -1 | cut -c1-90)"
  grep -a -E '^\S+ +FAIL ' "$OUT/kit-$i.log" | cut -c26-200 | head -5
done
echo "GATE-RUN-DONE: $pass of $RUNS passed"

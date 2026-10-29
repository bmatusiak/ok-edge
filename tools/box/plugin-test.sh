#!/usr/bin/env bash
# One kit test against the soft key built from one emulator commit - e.g. a plugin test run on the commit before a
# change (it must fail) and on the change (it must pass). Its own clone and build under ~/project/onlykey/plugin-test/
# <commit>, so the box's own soft keys (the gadget, the desktop app) are never rebuilt.
#   bash tools/box/plugin-test.sh <emulator commit> <kit section> <test name substring>
#   bash tools/box/plugin-test.sh c177e66 08-plugins "is refused, before any press"
# DEBUG v3.1.0 (the kit presses through the debug console) with the web app's plugins, its fixes as every build has
# them. Prints PLUGIN-TEST <commit>: PASS | FAIL, the kit's own lines above it.
source ~/.nvm/nvm.sh >/dev/null 2>&1
P=~/project/onlykey
C=${1:?emulator commit}; SECTION=${2:?kit section}; NAME=${3:?test name substring}
D=$P/plugin-test/$C
E=$D/node-onlykey-emulator/emulator
say() { echo "== $(date +%T) $*"; }
if [ ! -f "$E/build/Release/onlykey_emulator.node" ]; then
  rm -rf "$D"; mkdir -p "$D"
  git clone -q "$P/node-onlykey-emulator" "$D/node-onlykey-emulator" && git -C "$D/node-onlykey-emulator" checkout -q "$C" || { say "no commit $C"; exit 1; }
  cp -a "$P/node-onlykey-emulator/emulator/node_modules" "$E/"
  for s in OnlyKey-Firmware libraries arduino-1.6.5-r5-teensy_127; do ln -s "$P/$s" "$D/$s"; done
  say "build $C: v3.1.0, edge,ctap_bridge,derive_secret, DEBUG"
  (cd "$E" && OKEMU_VERSION=v3.1.0 OKEMU_PLUGINS=edge,ctap_bridge,derive_secret OKEMU_DEBUG=1 JOBS=max npm run rebuild > "$D/build.log" 2>&1) \
    || { say "build FAILED - $D/build.log"; exit 1; }
fi
say "kit $SECTION --test \"$NAME\" on $C ($(jq -c .fixes "$E/.stage/build.json"))"
cd "$P/onlykey-testing" || exit 1
OKEMU_ROOT=$E OKT_LIB_DIR=$P/node-onlykey-lib node bin/okt.js run "$SECTION" --test "$NAME" --jobs 1 2>&1 | tee "$D/kit.log" | tail -25
# the kit's own verdict line: OKT-END ... tests=<passed>p/<failed>f/<skipped>s - a pass is at least one test passed, none failed
v=$(grep -o 'tests=[0-9]*p/[0-9]*f' "$D/kit.log" | tail -1)
p=$(echo "$v" | sed -E 's/tests=([0-9]+)p.*/\1/'); f=$(echo "$v" | sed -E 's/.*p\/([0-9]+)f/\1/')
[ -n "$v" ] && [ "$p" -ge 1 ] && [ "$f" = 0 ] && echo "PLUGIN-TEST $C: PASS ($v)" || echo "PLUGIN-TEST $C: FAIL (${v:-no verdict line})"

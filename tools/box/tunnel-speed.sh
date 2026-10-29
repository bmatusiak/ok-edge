#!/usr/bin/env bash
# THE SPEED OF THE WEB APP'S TUNNEL, before and after emulator patch 0016 (experimental: a new request wipes a reply
# already delivered, so the lib asks again without its 5.5 s wait). One workload, two builds of the gadget soft key
# from one emulator commit - with and without our release (version_control) - on the same storage, in Chrome:
#   before   v3.1.0 as the maintainer published it       the web app built as the live site is (the lib waits)
#   after    our release (version_control: its patches, 0016 among them)   the web app built with EXPO_PUBLIC_KEY_WIPES_DELIVERED=1
# The workload (webapp-edge-budget.sh FRESH=1 SIGNS=3): a new copy's first sync (head, the key's checkpoint with its
# ML-DSA half), a budget request, Approve and its press, then three signs the budget pays with their receipts (the
# third ends the budget). Results in ~/project/onlykey/tunnel-speed/<build>.txt.
#   bash tools/box/tunnel-speed.sh build          # the two soft keys (minutes each)
#   bash tools/box/tunnel-speed.sh run before     # the gadget on that build, the web app to match, the workload
#   bash tools/box/tunnel-speed.sh run after
# TESTNET soft key only (the gadget's own storage, backed up once before the first switch).
source ~/.nvm/nvm.sh >/dev/null 2>&1
P=~/project/onlykey
W=$P/tunnel-speed
SRC=$P/node-onlykey-emulator
EDGE=$P/ok-edge
STORE=$P/webapp-softkey
PLUGINS=config,edge,key_chain,ctap_bridge,derive_secret
mkdir -p "$W"
say() { echo "== $(date +%T) $*"; }

build() {   # build <before|after>
  local d=$W/$1 pl=$PLUGINS
  [ "$1" = after ] && pl=$PLUGINS,version_control
  rm -rf "$d"; mkdir -p "$d"
  git clone -q "$SRC" "$d/node-onlykey-emulator"
  cp -a "$SRC/emulator/node_modules" "$d/node-onlykey-emulator/emulator/"
  for s in OnlyKey-Firmware libraries arduino-1.6.5-r5-teensy_127; do ln -s "$P/$s" "$d/$s"; done
  local E=$d/node-onlykey-emulator/emulator
  say "build $1 at $(git -C "$d/node-onlykey-emulator" rev-parse --short HEAD) (plugins $pl)"
  (cd "$E" && OKEMU_VERSION=v3.1.0 OKEMU_PLUGINS=$pl OKEMU_DEBUG=0 JOBS=max npm run rebuild > "$W/build-$1.log" 2>&1) \
    || { say "build $1 FAILED - $W/build-$1.log"; exit 1; }
  say "built $1: fixes $(jq -c .fixes "$E/.stage/build.json"), plugins $(jq -c .plugins "$E/.stage/build.json"), debug $(jq -c .debug "$E/.stage/build.json")"
}

use() {     # use <before|after>: the gadget soft key on that build, the web app built to match, the server restarted
  local E=$W/$1/node-onlykey-emulator/emulator
  [ -f "$E/.stage/build.json" ] || { say "no $1 build - tunnel-speed.sh build first"; exit 1; }
  [ -d "$STORE.before-tunnel-speed" ] || { cp -a "$STORE" "$STORE.before-tunnel-speed"; say "storage backed up: $STORE.before-tunnel-speed"; }
  bash "$EDGE/tools/box/softkey-gadget.sh" stop
  sleep 2
  EMU=$E bash "$EDGE/tools/box/softkey-gadget.sh" start | tail -1
  say "the gadget runs $1: fixes $(jq -c .fixes "$E/.stage/build.json")"
  local flag=
  [ "$1" = after ] && flag=1
  (cd "$EDGE" && EXPO_PUBLIC_KEY_WIPES_DELIVERED=$flag bash tools/box/webapp.sh build | tail -1)
  (cd "$EDGE" && HTTPS=1 bash tools/box/server.sh restart 2>&1 | tail -1)
  say "the web app built with EXPO_PUBLIC_KEY_WIPES_DELIVERED=${flag:-unset}"
}

run() {     # run <before|after>
  use "$1"
  local out=$W/$1.txt log=$W/$1-page.log t0
  t0=$(date +%s)
  say "workload on $1"
  FRESH=1 SIGNS=3 CONSOLE=$log bash "$EDGE/tools/box/webapp-edge-budget.sh" 2>&1 | tee "$W/$1-flow.log"
  {
    echo "tunnel speed: $1 ($(jq -c .fixes "$W/$1/node-onlykey-emulator/emulator/.stage/build.json")), $(date -Is)"
    echo "the whole workload: $(( $(date +%s) - t0 )) s (reload, PIN, bucket, fresh sync, request, Approve + press, 3 paid signs)"
    grep '^== ' "$W/$1-flow.log"
    node "$EDGE/tools/box/trace-times.js" "$log"
  } > "$out"
  cat "$out"
}

case "$1" in
  build) build before; build after ;;
  run) run "${2:?before or after}" ;;
  use) use "${2:?before or after}" ;;
  *) echo "usage: tunnel-speed.sh build | run <before|after> | use <before|after>"; exit 2 ;;
esac

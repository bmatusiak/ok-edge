#!/usr/bin/env bash
# THE LOGIN'S TIMELINE ON ONE SETUP (Brad, 2026-10-28: "measure the entire process from start of the webapp login to
# the end of bucket, see why in-between actions have a huge gap"; "try and eliminate as many timing gaps as we can"):
# the gadget soft key on one of tunnel-speed.sh's builds, the web app built with or without the 0016 flag, then the
# login - reload, PIN, the identity check, the bucket open - and tools/box/timeline.js over it.
#   bash tools/box/login-timeline.sh <before|after> <flag 0|1>
#     after 1   a key with 0016, the page told so (no 5.5 s waits): what is left is the page's own time
#     after 0   a key with 0016, the page as the live site is built (it still waits): key 2 on Windows today
#     before 0  3.1.0 as every key out there
# Needs tunnel-speed.sh build first. Results in ~/project/onlykey/tunnel-speed/login-<build>-<flag>.txt.
source ~/.nvm/nvm.sh >/dev/null 2>&1
P=~/project/onlykey
W=$P/tunnel-speed
EDGE=$P/ok-edge
B=${1:?before or after}; F=${2:?flag 0 or 1}
E=$W/$B/node-onlykey-emulator/emulator
[ -f "$E/.stage/build.json" ] || { echo "no $B build - tunnel-speed.sh build first"; exit 1; }
say() { echo "== $(date +%T) $*"; }
[ -d "$P/webapp-softkey.before-tunnel-speed" ] || cp -a "$P/webapp-softkey" "$P/webapp-softkey.before-tunnel-speed"
bash "$EDGE/tools/box/softkey-gadget.sh" stop >/dev/null
sleep 2
EMU=$E bash "$EDGE/tools/box/softkey-gadget.sh" start | tail -1
flag=; [ "$F" = 1 ] && flag=1
(cd "$EDGE" && EXPO_PUBLIC_KEY_WIPES_DELIVERED=$flag bash tools/box/webapp.sh build | tail -1)
(cd "$EDGE" && HTTPS=1 bash tools/box/server.sh restart 2>&1 | tail -1)
say "the gadget on $B ($(jq -c .fixes "$E/.stage/build.json")), the page's flag ${flag:-unset}"
out=$W/login-$B-$F
STOP_AFTER=bucket CONSOLE=$out-page.log bash "$EDGE/tools/box/webapp-edge-budget.sh" > "$out-flow.log" 2>&1
tail -2 "$out-flow.log"
node "$EDGE/tools/box/timeline.js" "$out-flow.log" "$out-page.log" > "$out.txt"
cat "$out.txt"

#!/bin/bash
# Run one onlykey-js command against the box's TEST hard key (key 2) and press its button 1 each time the CLI says the
# key waits for a press - never before (no blind presses: the CLI's own PRESS line is the sheet). The presses go through
# the key's DEBUG console (hardkey-press.js), so a production key is out of reach by construction.
# The CLI is ok-edge's copy of the lib: it sits next to node-hid (the lib's own clone does not install it).
# Quit the desktop app first - it takes the hard key's replies.
#   bash tools/box/hardkey-cli.sh edge --test-mode setup
#   bash tools/box/hardkey-cli.sh edge --test-mode budget --reason "demo" --ssh 2 --ttl 5
source ~/.nvm/nvm.sh >/dev/null
cd ~/project/onlykey/ok-edge || exit 1
LOG=$(mktemp /tmp/hardkey-cli.XXXXXX)
node node_modules/node-onlykey-lib/cli/index.js "$@" > "$LOG" 2>&1 < /dev/null &
CLI=$!
seen=0
while kill -0 $CLI 2>/dev/null; do
  sleep 0.5
  # a line asking for the press - not one saying not to, or that one was made
  n=$(grep -iE "press" "$LOG" | grep -viE "don.t press|pressed|no press|without a press" | wc -l)
  if [ "$n" -gt "$seen" ]; then
    seen=$n
    sleep 1
    node tools/box/hardkey-press.js 1 > /dev/null 2>&1 && echo "== pressed key 2 (the CLI asked)"
  fi
done
wait $CLI; code=$?
cat "$LOG"; rm -f "$LOG"
exit $code

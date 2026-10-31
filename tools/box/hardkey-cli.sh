#!/bin/bash
# Run one onlykey-js command against the box's TEST hard key (key 2) and press its button 1 each time the CLI says the
# key waits for a press - never before (no blind presses: the CLI's own PRESS line is the sheet). The presses go through
# the key's DEBUG console (hardkey-press.js), so a production key is out of reach by construction.
# The CLI is ok-edge's copy of the lib: it sits next to node-hid (the lib's own clone does not install it).
# Quit the desktop app first - it takes the hard key's replies.
#   ANSWER=y bash tools/box/hardkey-cli.sh edge --test-mode setup        (ANSWER: the y/N prompts, testnet only)
#   bash tools/box/hardkey-cli.sh edge --test-mode budget --reason "demo" --ssh 2 --ttl 5
source ~/.nvm/nvm.sh >/dev/null
cd ~/project/onlykey/ok-edge || exit 1
LOG=$(mktemp /tmp/hardkey-cli.XXXXXX)
# ANSWER=y answers the CLI's y/N prompts - only with --test-mode (automation is for TEST budgets alone)
if [ -n "$ANSWER" ]; then
  case " $* " in *" --test-mode "*) ;; *) echo "ANSWER is for --test-mode only"; exit 2;; esac
  yes "$ANSWER" 2>/dev/null | head -20 | node node_modules/node-onlykey-lib/cli/index.js "$@" > "$LOG" 2>&1 &
else
  node node_modules/node-onlykey-lib/cli/index.js "$@" > "$LOG" 2>&1 < /dev/null &
fi
CLI=$!
seen=0
while kill -0 $CLI 2>/dev/null; do
  sleep 0.5
  # only the CLI's own "the key waits now" lines (edge budget: "PRESS the key now"; a pressed sign/certify: "press on
  # the OnlyKey: <what>") - a heading that mentions a press to come ("answer y/N, then press the key") is not one
  n=$(grep -E "PRESS the key now|press on the OnlyKey:" "$LOG" | wc -l)
  if [ "$n" -gt "$seen" ]; then
    seen=$n
    sleep 1
    node tools/box/hardkey-press.js 1 > /dev/null 2>&1 && echo "== pressed key 2 (the CLI asked)"
  fi
done
wait $CLI; code=$?
cat "$LOG"; rm -f "$LOG"
exit $code

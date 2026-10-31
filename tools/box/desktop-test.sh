#!/bin/bash
# Start the ok-edge desktop TEST build on the xrdp display.
# Stops a running one first (by its PIDs, never a pattern that is also in this script's caller).
source ~/.nvm/nvm.sh >/dev/null
cd ~/project/onlykey/ok-edge || exit 1
old="$(pgrep -x electron) $(pgrep -f '^node electron/start.js')"
for p in $old; do kill "$p" 2>/dev/null; done
# gone before the new one starts: a closing one still holds the DevTools port and the window singleton (a fixed 2 s was not enough)
for _ in $(seq 1 30); do alive=""; for p in $old; do kill -0 "$p" 2>/dev/null && alive=1; done; [ -z "$alive" ] && break; sleep 0.5; done
export OKEDGE_NODE="$(which node)"
export DISPLAY=:10
# its window is driven like the web app's: CDP_PORT=9334 node tools/box/page-click.js ... (electron/main.js OKEDGE_DEVTOOLS_PORT)
export OKEDGE_DEVTOOLS_PORT=9334
setsid nohup npm run electron:test -- --no-sandbox > ../logs/desktop-test.log 2>&1 < /dev/null &
echo "$(date -Is) desktop-test.sh: started electron:test" >> ~/project/onlykey/steps.log
echo started

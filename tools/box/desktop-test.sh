#!/bin/bash
# Start the ok-edge desktop TEST build on the xrdp display, with the sync service's CLI.
# Stops a running one first (by its PIDs, never a pattern that is also in this script's caller).
source ~/.nvm/nvm.sh >/dev/null
cd ~/project/onlykey/ok-edge || exit 1
for p in $(pgrep -x electron) $(pgrep -f '^node electron/start.js'); do kill "$p" 2>/dev/null; done
sleep 2
export OKEDGE_NODE="$(which node)"
export OKEDGE_CLI="$HOME/project/onlykey/node-onlykey-lib/cli/index.js"
export DISPLAY=:10
# its window is driven like the web app's: CDP_PORT=9334 node tools/box/page-click.js ... (electron/main.js OKEDGE_DEVTOOLS_PORT)
export OKEDGE_DEVTOOLS_PORT=9334
setsid nohup npm run electron:test -- --no-sandbox > ../logs/desktop-test.log 2>&1 < /dev/null &
echo "$(date -Is) desktop-test.sh: started electron:test (OKEDGE_CLI set)" >> ~/project/onlykey/steps.log
echo started

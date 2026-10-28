#!/usr/bin/env bash
# The web app's Edge budget, end to end, on the box: Chromium (webapp.sh site) on the gadget soft key (softkey-gadget.sh),
# driven as a person would - reload, the identity check, open the bucket (its code entered on the key's buttons), the
# Edge tab, a test budget request, Approve, the press - then what the page says. Every step waits for what it needs on
# screen (page-click.js --labels) and says what it saw when it does not come.
#   bash tools/box/webapp-edge-budget.sh
source ~/.nvm/nvm.sh >/dev/null 2>&1
P=~/project/onlykey
cd $P/ok-edge || exit 1
C() { timeout 20 node tools/box/page-click.js "$@" 2>&1 | tail -1; }
labels() { timeout 10 node tools/box/page-click.js --labels 2>&1 | tail -1; }
press() { (cd $P/node-onlykey-emulator/emulator && timeout 30 node bin/press.js --socket=/tmp/okemu-webapp.sock --quiet "$@" 2>&1 | tail -1); }
L=
waitfor() {
  for _ in $(seq 1 ${2:-60}); do L=$(labels); echo "$L" | grep -q "$1" && return 0; sleep 0.5; done
  echo "!! never saw: $1 - the screen: $(echo "$L" | cut -c1-240)"; return 1
}
say() { echo "== $(date +%T) $*"; }

say "reload"
w=$(DISPLAY=:10 xdotool search --name "ok-edge - Chromium" | head -1)
DISPLAY=:10 xdotool windowactivate --sync "$w" key ctrl+shift+r
waitfor '\[Continue\]\|\[Decrypt Bucket\]' || exit 1
echo "$L" | grep -q '\[Continue\]' && { C "Continue" >/dev/null; waitfor '\[Decrypt Bucket\]' || exit 1; }
say "open the bucket"
C "Decrypt Bucket" >/dev/null
waitfor 'Press the key' || exit 1
code=$(echo "$L" | sed -E "s/.*Opening this identity.s bucket \| //" | grep -oE '[1-6]' | head -3 | tr '\n' ' ')
say "its code: $code"
# shellcheck disable=SC2086
press $code
waitfor '\[Menu\]' || exit 1
say "Edge tab, a test budget request"
C "Menu" wait:2 "Edge" wait:4 "Open Edge Management" wait:2 "Agent: request a budget" wait:2 "Close Edge Management" wait:2 >/dev/null
waitfor '\[Approve\]' 40 || exit 1
say "the sheet: $(echo "$L" | sed 's/.*Presses | //' | cut -c1-200)"
C "Approve" >/dev/null
sleep 3
say "after Approve: $(labels | sed 's/.*Presses | //' | cut -c1-200)"
say "press"
press 1
sleep 10
say "the Edge tab now:"
timeout 30 node tools/box/page-click.js --text 3000 2>&1 | grep -iv '^TEST BUILD\|^Testing mode' | sed -n '/^Budgets/,$p' | head -14 | cut -c1-200

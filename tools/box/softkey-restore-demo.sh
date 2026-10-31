#!/bin/bash
# The box desktop app's TESTNET soft key as a new device made from a backup, end to end:
#   wipe it -> setup (PIN 1111111) -> "Restore a backup" (the file + its passphrase, filled by page-fill.js, never
#   printed) -> restart -> unlock -> open the identity's bucket -> make this device's login card -> one budget with
#   three signs it pays (Edge Management's Testing buttons).
# A restore is a new device (a new salted id) forked from the backup's head: run it twice from one backup and the
# Edge tab shows both forks of one point - the flag (2026-10-31).
#
# EVENT DRIVEN (Brad, 2026-10-31: "your script should be event based, not timer based ... if a timer is used you will
# always fail"): no sleeps. A step starts page-presser.js BEFORE the click that sets it off; the presser presses each
# sheet the moment the app logs it live, and ends on the app's own line for the step's outcome. page-click waits for a
# control by the page's own changes (MutationObserver). The only timers are inactivity cutoffs.
#   bash tools/box/softkey-restore-demo.sh <backup.txt> <passphrase.json> [json key=passphrase]
source ~/.nvm/nvm.sh >/dev/null
cd ~/project/onlykey/ok-edge || exit 1
BACKUP="$1"; PASS="$2"; KEY="${3:-passphrase}"
[ -f "$BACKUP" ] && [ -f "$PASS" ] || { echo "usage: softkey-restore-demo.sh <backup.txt> <passphrase.json> [key]"; exit 2; }
export CDP_PORT=9334
say() { echo "== $(date +%T) $*"; }
C() { timeout 120 node tools/box/page-click.js "$@" 2>&1 | tail -1 | cut -c1-200; }
# the first line of `file` matching `re`, as it is written (tail -f, no polling); the reader ends with the match
waitline() {
  local file="$1" re="$2" tp
  tp=$(mktemp)
  ( tail -n +1 -f "$file" & echo $! > "$tp"; wait ) | grep -m1 -E "$re"
  kill "$(cat "$tp")" 2>/dev/null; rm -f "$tp"
}
# step "<outcome regex>" <clicks...>: the presser listens first, then the clicks, then the outcome (or its failure)
step() {
  local until="$1"; shift
  local log; log=$(mktemp)
  node tools/box/page-presser.js --approve --until "$until" --idle 120 --show 'failed|refused|Not made|did not' > "$log" 2>&1 &
  local p=$!
  waitline "$log" 'listening' > /dev/null
  [ $# -gt 0 ] && C "$@"
  wait $p; local code=$?
  sed 's/^/   /' "$log"; rm -f "$log"
  return $code
}
# the app (re)started, and its page is up: the main process's own line, then the login screen's button
appup() {
  bash tools/box/desktop-test.sh > /dev/null
  waitline ../logs/desktop-test.log '\[hosting\] desktop: listening' > /dev/null
  C "Enter testing mode" > /dev/null
}

say "1. wipe the soft key"
appup
C "Factory reset" "Really wipe it" "?Restart the app" > /dev/null
appup
C "Menu" "This Key" > /dev/null
say "2. PIN 1111111"
B="Button 1"; C "$B" "$B" "$B" "$B" "$B" "$B" "$B" "Next" "$B" "$B" "$B" "$B" "$B" "$B" "$B" "Set the PIN"
say "3. restore"
C "Restore a backup" > /dev/null
node tools/box/page-fill.js "-----BEGIN ONLYKEY BACKUP-----" "$BACKUP"
node tools/box/page-fill.js "the backup's passphrase" "$PASS" "$KEY"
C "Restore" "?Restart the app" > /dev/null
say "4. restart, unlock: the bucket opens and the login card is offered"
appup
C "Menu" "This Key" > /dev/null
step '\[card\] .*(offered|taken from the bucket)' "Button 1" "Button 1" "Button 1" "Button 1" "Button 1" "Button 1" "Button 1" || exit 1
say "5. the card: one certify press"
step '\[card\] .*certified at' "Make the card" || exit 1
say "6. Edge: a budget (approve + press), three signs it pays"
C "Menu" "Edge" "▲ Edge Management" "Agent: request a budget" "Close Edge Management" > /dev/null
step 'end #[0-9]+ Edge: opening a budget .*ok' "Approve" || exit 1
for i in 1 2 3; do
  step 'end #[0-9]+ Edge: filing a receipt .*ok' "▲ Edge Management" "Agent: a sign the budget pays" || exit 1
  C "Close Edge Management" > /dev/null
done
timeout 20 node tools/box/page-click.js --text 4000 | sed -n '/^Past budgets/,$p' | head -12
say "done"

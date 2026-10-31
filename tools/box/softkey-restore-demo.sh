#!/bin/bash
# The box desktop app's TESTNET soft key as a new device made from a backup, end to end:
#   wipe it -> setup (PIN 1111111) -> "Restore a backup" (the file + its passphrase, filled by page-fill.js, never
#   printed) -> restart -> unlock -> open the identity's bucket -> make this device's login card -> one budget with
#   three signs it pays (Edge Management's Testing buttons) - every press only when the app's sheet asks for it.
# A restore is a new device (a new salted id) forked from the backup's head: run it twice from one backup and the
# Edge tab shows both forks of one point - the flag (2026-10-31).
#   bash tools/box/softkey-restore-demo.sh <backup.txt> <passphrase.json> [json key=passphrase]
source ~/.nvm/nvm.sh >/dev/null
cd ~/project/onlykey/ok-edge || exit 1
BACKUP="$1"; PASS="$2"; KEY="${3:-passphrase}"
[ -f "$BACKUP" ] && [ -f "$PASS" ] || { echo "usage: softkey-restore-demo.sh <backup.txt> <passphrase.json> [key]"; exit 2; }
say() { echo "== $(date +%T) $*"; }
C() { CDP_PORT=9334 timeout 90 node tools/box/page-click.js "$@" 2>&1 | tail -1 | cut -c1-200; }
L() { CDP_PORT=9334 timeout 20 node tools/box/page-click.js --labels 2>&1 | tail -1; }
has() { case "$(L)" in *"$1"*) return 0;; esac; return 1; }
waitfor() { for _ in $(seq 1 "${2:-30}"); do has "$1" && return 0; sleep 1; done; say "never saw \"$1\" - there: $(L | cut -c1-300)"; return 1; }
# answer the app's own press sheets until `until` shows - or, as "!text", until text is gone (a sheet closed). A press
# sheet is answered FIRST: the page under a sheet still says everything it said (Slots, Edge...), so checking `until`
# first returned with the key still waiting (2026-10-31: the login card's certify was never pressed).
presses() {
  local until="$1" n=0
  for _ in $(seq 1 "${2:-90}"); do
    T=$(L)
    case "$T" in
      *"Press the soft key"*) C "Press the soft key" >/dev/null; n=$((n + 1)); sleep 2; continue;;
      *"Try again"*) say "failed: $(CDP_PORT=9334 timeout 20 node tools/box/page-click.js --text 5000 | grep -E 'did not|Not made|Error' | head -1 | cut -c1-200)"; return 1;;
    esac
    if [ "${until#!}" != "$until" ]; then
      case "$(CDP_PORT=9334 timeout 20 node tools/box/page-click.js --text 8000)" in *"${until#!}"*) ;; *) say "\"${until#!}\" gone after $n press(es)"; return 0;; esac
    else
      case "$T" in *"$until"*) say "reached \"$until\" after $n press(es)"; return 0;; esac
    fi
    sleep 1
  done
  say "timed out before \"$until\""; return 1
}
restart() { bash tools/box/desktop-test.sh >/dev/null; sleep 10; waitfor "Enter testing mode" 40 && C "Enter testing mode" >/dev/null && sleep 3; }
unlock() { C "Menu" wait:1 "This Key" wait:2 >/dev/null; for _ in 1 2 3 4 5 6 7; do C "Button 1" >/dev/null; sleep 0.4; done; }

say "1. wipe the soft key"
restart || exit 1
C "Factory reset" wait:1 "Really wipe it" wait:5 >/dev/null
restart || exit 1
C "Menu" wait:1 "This Key" wait:2 >/dev/null
waitfor "Choose a PIN" || exit 1
say "2. PIN 1111111"
B="Button 1"; C "$B" "$B" "$B" "$B" "$B" "$B" "$B" "Next" wait:1 "$B" "$B" "$B" "$B" "$B" "$B" "$B" "Set the PIN" >/dev/null
waitfor "Restore a backup" 40 || exit 1
say "3. restore"
C "Restore a backup" wait:2 >/dev/null
CDP_PORT=9334 node tools/box/page-fill.js "-----BEGIN ONLYKEY BACKUP-----" "$BACKUP"
CDP_PORT=9334 node tools/box/page-fill.js "the backup's passphrase" "$PASS" "$KEY"
C "Restore" >/dev/null
waitfor "Restart the app" 60 || exit 1
say "4. restart, unlock, open the bucket, make the card"
restart || exit 1
unlock
presses "Slots" 120 || exit 1
# the card offer comes after the first sync
for _ in $(seq 1 20); do has "Make the card" && break; sleep 1; done
has "Make the card" && { C "Make the card" >/dev/null; sleep 2; presses "!login card" 60 || exit 1; }
say "5. Edge: one budget, three signs it pays"
C "Menu" wait:1 "Edge" wait:4 "▲ Edge Management" wait:2 "Agent: request a budget" wait:2 "Close Edge Management" wait:2 >/dev/null
waitfor "Approve" 20 || exit 1
C "Approve" >/dev/null; sleep 2
presses "!Waiting for you" 40 || exit 1
for i in 1 2 3; do C "▲ Edge Management" wait:2 "Agent: a sign the budget pays" wait:6 "Close Edge Management" wait:2 >/dev/null; done
CDP_PORT=9334 timeout 20 node tools/box/page-click.js --text 4000 | sed -n '/^Past budgets/,$p' | head -12
say "done"

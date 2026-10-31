#!/bin/bash
# The box desktop app's TESTNET soft key as a new device made from a backup, end to end:
#   wipe it -> setup (PIN 1111111) -> "Restore a backup" (the file + its passphrase, filled by page-fill.js, never
#   printed) -> restart -> unlock -> open the identity's bucket -> make this device's login card -> one budget with
#   three signs it pays (Edge Management's Testing buttons).
# A restore is a new device (a new salted id) forked from the backup's head: run it twice from one backup and the
# Edge tab shows both forks of one point - the flag (2026-10-31).
# Event driven: tools/box/drive.sh.
#   bash tools/box/softkey-restore-demo.sh <backup.txt> <passphrase.json> [json key=passphrase]
BACKUP="$1"; PASS="$2"; KEY="${3:-passphrase}"
[ -f "$BACKUP" ] && [ -f "$PASS" ] || { echo "usage: softkey-restore-demo.sh <backup.txt> <passphrase.json> [key]"; exit 2; }
source "$(dirname "$0")/drive.sh" || exit 1

# every move waits for the screen it belongs to (?label) and the run stops at the first one that does not happen
fail() { say "STOPPED at: $*"; session_off; exit 1; }
# every press sheet answered whenever it comes, for the whole run (drive.sh session_on, restarted by appup)
SESSION=1
B="Button 1"
say "1. wipe the soft key"
appup || fail "the app did not come up"
C "Factory reset" "Really wipe it" "?Restart the app" || fail "the wipe"
appup || fail "the app did not come up after the wipe"
goto "This Key" && C "?Choose a PIN" || fail "the setup screen"
say "2. PIN 1111111"
C "$B" "$B" "$B" "$B" "$B" "$B" "$B" "Next" "?Enter it again" || fail "the first PIN pass"
C "$B" "$B" "$B" "$B" "$B" "$B" "$B" "Set the PIN" "?Restore a backup" || fail "the PIN"
say "3. restore"
C "Restore a backup" "?Open a file" || fail "the restore screen"
node tools/box/page-fill.js "-----BEGIN ONLYKEY BACKUP-----" "$BACKUP" || fail "filling the backup"
node tools/box/page-fill.js "the backup's passphrase" "$PASS" "$KEY" || fail "filling the passphrase"
C "Restore" "?Restart the app" || fail "the restore"
say "4. restart, unlock: the bucket opens and the login card is offered"
appup || fail "the app did not come up after the restore"
goto "This Key" && C "?Locked" || fail "the keypad"
step '\[card\] .*(offered|taken from the bucket)' "$B" "$B" "$B" "$B" "$B" "$B" "$B" || fail "the login"
say "5. the card: one certify press"
C "?Make the card" || fail "the card offer"
step '\[card\] .*certified at' "Make the card" || fail "the card"
say "6. Edge: a budget (approve + press), three signs it pays"
budget_demo || fail "the budget"
session_off
say "done"

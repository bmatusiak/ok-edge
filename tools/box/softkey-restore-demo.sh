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
budget_demo || exit 1
say "done"

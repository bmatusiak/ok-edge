#!/usr/bin/env bash
# Flash a DEVELOPER hard key on the box with a hex - e.g. the one downloaded from the web app's login page.
#   tools/box/flash-key.sh <hex> [sha256]
# 1. checks the hex's sha256: the one given, else firmware/manifest.json's (what the site publishes) - no match, no flash
# 2. waits up to 15 min for the key's HalfKay bootloader (16c0:0478) - its bootloader button is the person's to press
# 3. flashes it with the kit's HalfKay flasher (onlykey-testing `okt flash`) - never OKFWUPDATE
# Logs to ~/project/onlykey/logs/flash-<time>.log and prints FLASH-DONE <exit>; one line in steps.log.
# The emulator's USB gadget also shows as an OnlyKey (1d50:60fc): the bootloader's 16c0:0478 is the only proof here.
source ~/.nvm/nvm.sh >/dev/null 2>&1
ROOT=~/project/onlykey
HEX="$1"
[ -f "$HEX" ] || { echo "usage: $0 <hex> [sha256]"; exit 1; }
WANT="${2:-$(node -e "console.log(require('$ROOT/ok-edge/firmware/manifest.json').sha256)")}"
LOG=$ROOT/logs/flash-$(date +%Y%m%d-%H%M%S).log
{
echo "== $(date -Is) flash <- $HEX"
have=$(sha256sum "$HEX" | cut -c1-64)
[ "$have" = "$WANT" ] || { echo "hex sha256 $have, expected $WANT - not flashing"; echo "FLASH-DONE 1"; exit 1; }
echo "   sha256 $have (matches)"
echo "== waiting up to 900 s for the HalfKay bootloader (16c0:0478)"
for _ in $(seq 1 1800); do lsusb -d 16c0:0478 >/dev/null 2>&1 && break; sleep 0.5; done
lsusb -d 16c0:0478 >/dev/null 2>&1 || { echo "no bootloader within 900 s - nothing flashed"; echo "FLASH-DONE 1"; exit 1; }
echo "== $(date -Is) bootloader up - flashing"
cd $ROOT/onlykey-testing || exit 1
node bin/okt.js flash "$HEX"; rc=$?
echo "== $(date -Is) flash exit $rc"
sleep 4; lsusb | grep -iE "16c0|1d50"
echo "FLASH-DONE $rc"
} > "$LOG" 2>&1
echo "$(date -Is) flash-key: $(basename "$HEX") -> $(grep -o 'FLASH-DONE [0-9]*' "$LOG") ($LOG)" >> $ROOT/steps.log
grep -E "^==|sha256|FLASH-DONE|expected" "$LOG"

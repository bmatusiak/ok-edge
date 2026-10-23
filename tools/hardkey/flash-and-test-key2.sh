#!/usr/bin/env bash
# ok-edge TODO A4, on the firmware box: put the Edge developer build on KEY 2 and test it.
#   1. waits (up to 15 min) for key 2 in its HalfKay bootloader (16c0:0478) - press its bootloader button
#   2. flashes the hex build-hardkey.sh made (HalfKay only, never OKFWUPDATE), after checking its SHA-256
#   3. the kit's protocol + security sections, as the RC's final pass ran them, plus Edge's own tests
#      through 38's hard-key gate - the kit provisions the wiped key itself (state 'initialized')
# Every press after the bootloader one goes through the key's debug console.
source ~/.nvm/nvm.sh >/dev/null 2>&1
ROOT=~/project/onlykey
HEX=$ROOT/fw-edge/images/v3.1.0-test-edge-fw9fceea1-lib2ce5fce.hex
WANT=${WANT_SHA:-abba58e0c826410069a03262b6a932605c1f33927c48812a295a6db2b6946505}
LOGS=$ROOT/fw-edge/logs; mkdir -p "$LOGS"
LOG=$LOGS/key2-edge-$(date +%Y%m%d-%H%M).log
{
echo "== $(date -Is) key 2 <- $(basename "$HEX")"
have=$(sha256sum "$HEX" | cut -c1-64)
[ "$have" = "$WANT" ] || { echo "hex SHA-256 $have, expected $WANT - not flashing"; exit 1; }
echo "   sha256 $have"
echo "== waiting up to 900 s for the HalfKay bootloader (press key 2's bootloader button)"
for i in $(seq 1 1800); do lsusb -d 16c0:0478 >/dev/null 2>&1 && break; sleep 0.5; done
lsusb -d 16c0:0478 >/dev/null 2>&1 || { echo "no bootloader within 900 s - nothing flashed"; exit 1; }
cd $ROOT/onlykey-testing || exit 1
node bin/okt.js flash "$HEX"; rc=$?
echo "== $(date -Is) flash exit $rc"; [ $rc = 0 ] || exit 1
sleep 4; lsusb | grep -iE "16c0|1d50"
echo "== $(date -Is) kit $(git rev-parse --short HEAD): 01-protocol 05-security --hardware, Edge named for the hard key"
OKT_VENV=$ROOT/release-3.1.0-test/ok310 OKT_ALLOW_FIDO_RESET=yes \
OKT_HARDKEY_PLUGINS=edge OKT_HARDKEY_PLUGINS_DIR=$ROOT/node-onlykey-emulator/emulator/plugins \
  node bin/okt.js run 01-protocol 05-security --hardware --keep-going
echo "== $(date -Is) exit $?"
echo KEY2-EDGE-DONE
} > "$LOG" 2>&1
echo "== $(date -Is) key 2 Edge build: flash + kit finished ($LOG)" >> $ROOT/steps.log

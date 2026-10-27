#!/bin/bash
# Answer the soft key's press sheet on the phone, whatever it asks (testing mode, testnet soft key only).
#
# The sheet shows either one button ("Press the soft key") or the code it worked out from the firmware's record
# ("Enter this code on the key: 5 4 2") above a 1-6 keypad. This reads which, then taps the button or the code's
# digits in turn - one call, so the taps land inside the key's 20 s window.
#
#   tools/box/sheet-code.sh            wait up to 15 s for a sheet, then answer it
#   ANDROID_SERIAL=<pixel> ...         as tools/tap.js
set -u
cd "$(dirname "$0")/../.."
for i in $(seq 1 15); do
  L=$(timeout 30 node tools/tap.js --labels 2>&1)
  CODE=$(printf '%s\n' "$L" | sed -n 's/.*Enter this code on the key: *\([1-6]\) \([1-6]\) \([1-6]\).*/\1 \2 \3/p' | head -1)
  if [ -n "$CODE" ]; then
    echo "sheet: code $CODE"
    # shellcheck disable=SC2086
    exec timeout 60 node tools/tap.js $CODE
  fi
  if printf '%s\n' "$L" | grep -qx "Press the soft key"; then
    echo "sheet: press"
    exec timeout 30 node tools/tap.js "Press the soft key"
  fi
  sleep 1
done
echo "sheet-code: no press sheet within 15 s" >&2
exit 1

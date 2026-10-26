#!/bin/bash
# TESTNET ONLY: for $1 seconds (default 120), tap the Pixel's "Press the soft key" whenever its press sheet shows.
# The Pixel's testing-mode soft key is a throwaway key; never point this at a live key or the A13.
source ~/.nvm/nvm.sh >/dev/null
export ANDROID_SERIAL=26251JEGR09693 PATH=$PATH:$HOME/Android/Sdk/platform-tools
cd ~/project/onlykey/ok-edge || exit 1
end=$(( $(date +%s) + ${1:-120} ))
n=0
while [ "$(date +%s)" -lt "$end" ]; do
  labels=$(timeout 15 node tools/tap.js --labels 2>/dev/null)
  if echo "$labels" | grep -q "TESTNET" && echo "$labels" | grep -q "^Press the soft key$"; then
    timeout 15 node tools/tap.js "Press the soft key" 2>&1 | tail -1
    n=$((n + 1))
    sleep 2
  else
    sleep 1
  fi
done
echo "press-watch: pressed $n time(s)"

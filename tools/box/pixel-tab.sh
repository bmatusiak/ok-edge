#!/bin/bash
# Open one ok-edge tab on the Pixel by name and PROVE it is on screen (the title bar shows it); exit 1 otherwise.
# Callers chain their next taps on success only - a tap at a fixed point is never sent to an unchecked screen.
source ~/.nvm/nvm.sh >/dev/null
export ANDROID_SERIAL=26251JEGR09693 PATH=$PATH:$HOME/Android/Sdk/platform-tools
cd ~/project/onlykey/ok-edge || exit 1
want="$1"
title() { timeout 20 node tools/tap.js --labels 2>/dev/null | sed -n '1,8p' | grep -x -- "$want" >/dev/null; }
for try in 1 2 3 4; do
  title && { echo "on $want"; exit 0; }
  timeout 25 node tools/tap.js Menu >/dev/null 2>&1
  sleep 1
  timeout 25 node tools/tap.js "$want" >/dev/null 2>&1
  sleep 2
done
title && { echo "on $want"; exit 0; }
echo "NOT on $want" >&2
exit 1

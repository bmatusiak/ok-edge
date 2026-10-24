#!/usr/bin/env bash
# capture the box side of a Bluetooth failure with the Pixel (ok-rn tools/btcapture.js)
source ~/.nvm/nvm.sh >/dev/null 2>&1
cd ~/project/onlykey/ok-rn
node tools/btcapture.js --phone "Pixel 6a" --mac 24:29:34:86:EA:AF 2>&1 | tail -15

#!/usr/bin/env bash
# Edge over Bluetooth from the box to the Pixel: onlykey-js --ble edge <args> (testnet: pass --test-mode)
source ~/.nvm/nvm.sh >/dev/null 2>&1
cd ~/project/onlykey/node-onlykey-lib
node cli/index.js --ble --address "Pixel 6a" edge "$@" 2>&1 | grep -av --line-buffered "^DEBUG"

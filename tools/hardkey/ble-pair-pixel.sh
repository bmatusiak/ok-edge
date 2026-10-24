#!/usr/bin/env bash
# Part T pairing: the box (TP-Link 5.1, hci0) with the Pixel 6a - the phone and this terminal show the same 6-digit code.
source ~/.nvm/nvm.sh >/dev/null 2>&1
cd ~/project/onlykey/node-onlykey-lib
node cli/index.js --ble pair --address 24:29:34:86:EA:AF 2>&1 | grep -av --line-buffered "^DEBUG"

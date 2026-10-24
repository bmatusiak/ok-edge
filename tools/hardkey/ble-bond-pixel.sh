#!/usr/bin/env bash
# OS-level bond, the box (TP-Link 5.1) <-> the Pixel 6a: the lib's own script (numeric comparison, prefer LE)
cd ~/project/onlykey/node-onlykey-lib
bash scripts/ble-linux-connect.sh "Pixel 6a" "$@"

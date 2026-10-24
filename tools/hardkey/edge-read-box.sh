#!/usr/bin/env bash
# read key 2's Edge state (read only) - ok-edge tools/hardkey/edge-read.js
source ~/.nvm/nvm.sh >/dev/null 2>&1
export NODE_PATH=~/project/onlykey/onlykey-testing/node_modules
node ~/project/onlykey/fw-edge/edge-read.js ~/project/onlykey/node-onlykey-lib 8

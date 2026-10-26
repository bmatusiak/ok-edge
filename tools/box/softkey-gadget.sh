#!/bin/bash
# The testnet SOFT key as a real USB OnlyKey on the box (the emulator's dummy_hcd gadget), so a browser reaches it over
# WebAuthn. Runs a COPY of the box desktop app's testnet soft key (same key, same identity) - never the folder a running
# app uses: two firmware runs on one flash would corrupt it.
#   tools/box/softkey-gadget.sh start | stop | status
set -u
ROOT=~/project/onlykey
STORE=$ROOT/webapp-softkey
SRC=~/.config/Electron-test/okemu/plugins-config.edge-test
SOCK=/tmp/okemu-webapp.sock
LOG=$ROOT/logs/webapp-softkey.log
pid() { pgrep -f "bin/daemon.js --storage $STORE" | head -1; }
case "${1:-status}" in
  start)
    [ -n "$(pid)" ] && { echo "running (pid $(pid))"; exit 0; }
    [ -d "$STORE" ] || cp -a "$SRC" "$STORE"
    source ~/.nvm/nvm.sh >/dev/null
    cd $ROOT/node-onlykey-emulator/emulator || exit 1
    setsid nohup node bin/daemon.js --storage "$STORE" --socket "$SOCK" > "$LOG" 2>&1 < /dev/null &
    sleep 5; tail -2 "$LOG"
    echo "$(date -Is) softkey-gadget: started ($STORE)" >> $ROOT/steps.log ;;
  stop)
    p=$(pid); [ -n "$p" ] && kill "$p" && echo "stopped $p" || echo "not running"
    echo "$(date -Is) softkey-gadget: stopped" >> $ROOT/steps.log ;;
  status)
    p=$(pid); [ -n "$p" ] && echo "running (pid $p), storage $STORE" || echo "not running"; tail -2 "$LOG" 2>/dev/null ;;
esac

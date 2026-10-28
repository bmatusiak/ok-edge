#!/bin/bash
# The testnet SOFT key as a real USB OnlyKey on the box (the emulator's dummy_hcd gadget), so a browser reaches it over
# WebAuthn. Runs a COPY of the box desktop app's testnet soft key (same key, same identity) - never the folder a running
# app uses: two firmware runs on one flash would corrupt it.
#   tools/box/softkey-gadget.sh start | stop | status
# The firmware's own restart (CPU_RESTART - config mode, a wipe, its timeouts) ends the emulator process; a loop starts
# it again on the same storage, so the soft key comes back the way a hard key does (2026-10-28: it restarted itself in a
# web app run and stayed gone).
set -u
ROOT=~/project/onlykey
STORE=$ROOT/webapp-softkey
SRC=~/.config/Electron-test/okemu/plugins-config.edge-test
SOCK=/tmp/okemu-webapp.sock
LOG=$ROOT/logs/webapp-softkey.log
LOOP=$ROOT/logs/webapp-softkey.loop.pid
pid() { pgrep -f "bin/daemon.js --storage $STORE" | head -1; }
loop() { [ -f "$LOOP" ] && kill -0 "$(cat "$LOOP")" 2>/dev/null && cat "$LOOP"; }
case "${1:-status}" in
  start)
    [ -n "$(loop)" ] && { echo "running (loop $(loop), daemon $(pid))"; exit 0; }
    [ -d "$STORE" ] || cp -a "$SRC" "$STORE"
    source ~/.nvm/nvm.sh >/dev/null
    # EMU=<emulator dir>: another build of the soft key on the same storage (tunnel-speed.sh: with and without a patch)
    cd "${EMU:-$ROOT/node-onlykey-emulator/emulator}" || exit 1
    : > "$LOG"
    setsid nohup bash -c "echo \$\$ > '$LOOP'; while :; do node bin/daemon.js --storage '$STORE' --socket '$SOCK' >> '$LOG' 2>&1; echo \"[softkey-gadget] the emulator exited - starting it again\" >> '$LOG'; sleep 1; done" > /dev/null 2>&1 < /dev/null &
    sleep 5; tail -2 "$LOG"
    echo "$(date -Is) softkey-gadget: started ($STORE)" >> $ROOT/steps.log ;;
  stop)
    l=$(loop); [ -n "$l" ] && kill "$l" && rm -f "$LOOP"
    p=$(pid); [ -n "$p" ] && kill "$p"
    [ -n "$l$p" ] && echo "stopped (loop ${l:-none}, daemon ${p:-none})" || echo "not running"
    echo "$(date -Is) softkey-gadget: stopped" >> $ROOT/steps.log ;;
  status)
    l=$(loop); p=$(pid)
    [ -n "$l" ] && echo "running (loop $l, daemon ${p:-restarting}), storage $STORE" || echo "not running"
    tail -2 "$LOG" 2>/dev/null ;;
esac

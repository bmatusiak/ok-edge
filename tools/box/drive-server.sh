#!/bin/bash
# The drive server on the box (tools/drive/server.js, PROPOSAL-drive.md) - started once, by its pid file, with its
# live window on the box screen (DISPLAY=:10) showing every line of every run (Brad: "I hate being blind").
#   bash tools/box/drive-server.sh          start it (and the window) unless it runs
#   bash tools/box/drive-server.sh stop     stop both, by their pids
source ~/.nvm/nvm.sh >/dev/null
cd ~/project/onlykey/ok-edge || exit 1
L=~/project/onlykey/logs
SPID=$L/drive-server.pid
WPID=$L/drive-server-window.pid
alive() { [ -f "$1" ] && kill -0 "$(cat "$1")" 2>/dev/null; }
if [ "$1" = stop ]; then
  for f in "$SPID" "$WPID"; do alive "$f" && kill "$(cat "$f")"; rm -f "$f"; done
  echo stopped; exit 0
fi
if ! alive "$SPID"; then
  setsid nohup node tools/drive/server.js > "$L/drive-server.out" 2>&1 < /dev/null &
  echo $! > "$SPID"
fi
if ! alive "$WPID"; then
  cat > "$L/drive-server-watch.sh" <<EOF
echo "== the drive server (logs/drive-server.log) =="
tail -n 30 -F $L/drive-server.log
EOF
  DISPLAY=:10 XAUTHORITY=$HOME/.Xauthority setsid xfce4-terminal --title "drive server (live)" --geometry 150x45 \
    -e "bash $L/drive-server-watch.sh" > /dev/null 2>&1 < /dev/null &
  echo $! > "$WPID"
fi
echo "drive server pid $(cat "$SPID"), window pid $(cat "$WPID")"

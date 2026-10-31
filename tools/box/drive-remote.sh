#!/bin/bash
# DRIVE-REMOTE on the box (tools/drive/remote.js): the apps here dial it (127.0.0.1:8790) and it relays them to the
# drive server on Windows, which dials in on :8791 with the shared token (~/.onlykey-drive-token, the same file on
# both machines); it starts, stops and restarts the targets here. Its live window on the box screen (DISPLAY=:10)
# shows its own lines and every line of every run (Brad: "I hate being blind"). Started once, by its pid file.
# The box's local drive server (drive-server.sh) uses the same app port: the two do not run together.
#   bash tools/box/drive-remote.sh          start it (and the window) unless it runs
#   bash tools/box/drive-remote.sh stop     stop both, by their pids
source ~/.nvm/nvm.sh >/dev/null
cd ~/project/onlykey/ok-edge || exit 1
L=~/project/onlykey/logs
RPID=$L/drive-remote.pid
WPID=$L/drive-remote-window.pid
alive() { [ -f "$1" ] && kill -0 "$(cat "$1")" 2>/dev/null; }
if [ "$1" = stop ]; then
  for f in "$RPID" "$WPID"; do alive "$f" && kill "$(cat "$f")"; rm -f "$f"; done
  echo stopped; exit 0
fi
[ -s ~/.onlykey-drive-token ] || { echo "no ~/.onlykey-drive-token - the drive server's machine has the same file"; exit 2; }
if alive ~/project/onlykey/logs/drive-server.pid; then bash tools/box/drive-server.sh stop > /dev/null; fi
if ! alive "$RPID"; then
  setsid nohup node tools/drive/remote.js > "$L/drive-remote.out" 2>&1 < /dev/null &
  echo $! > "$RPID"
fi
if ! alive "$WPID"; then
  cat > "$L/drive-remote-watch.sh" <<EOF
echo "== drive-remote: the box's apps and every run's lines (logs/drive-remote.log) =="
tail -n 30 -F $L/drive-remote.log
EOF
  DISPLAY=:10 XAUTHORITY=$HOME/.Xauthority setsid xfce4-terminal --title "drive (live)" --geometry 150x45 \
    -e "bash $L/drive-remote-watch.sh" > /dev/null 2>&1 < /dev/null &
  echo $! > "$WPID"
fi
echo "drive-remote pid $(cat "$RPID"), window pid $(cat "$WPID")"

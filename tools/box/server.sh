#!/bin/bash
# The user's server (mcp-server/, wrangler dev) on the box, by its pid file - never by `pkill -f`, which matches the
# ssh command line that runs it and kills the caller.
#   tools/box/server.sh start|stop|restart|status|test
# start: npm run server:dev in its own session (log ~/project/onlykey/logs/server-dev.log), waits for "Ready on".
# test:  the M1 room tests against it (mcp-server/test/rooms.test.js).
# wrangler dev does not reload code synced from Windows reliably: restart after a sync.
source ~/.nvm/nvm.sh >/dev/null
cd ~/project/onlykey/ok-edge || exit 1
LOG=~/project/onlykey/logs/server-dev.log
PID=/tmp/okedge-server.pid

running() { [ -s "$PID" ] && kill -0 "$(cat "$PID")" 2>/dev/null; }

stop() {
  if running; then
    kill -- -"$(cat "$PID")" 2>/dev/null || kill "$(cat "$PID")"
    for _ in $(seq 1 20); do running || break; sleep 0.5; done
    echo "stopped $(cat "$PID")"
  else
    echo "not running"
  fi
  rm -f "$PID"
}

start() {
  running && { echo "running $(cat "$PID")"; return; }
  setsid npm run server:dev > "$LOG" 2>&1 < /dev/null &
  echo $! > "$PID"
  for _ in $(seq 1 90); do grep -qE "Ready on|✘" "$LOG" && break; sleep 2; done
  grep -E "Ready on|✘" "$LOG" | head -3
}

case "${1:-status}" in
  start) start ;;
  stop) stop ;;
  restart) stop; start ;;
  status) running && echo "running $(cat "$PID")" || echo "not running" ;;
  test) OKS_URL=http://127.0.0.1:8787 timeout 120 node --test mcp-server/test/rooms.test.js 2>&1 | grep -E "^✔|^✖|^ℹ (tests|pass|fail)" ;;
  *) echo "usage: $0 start|stop|restart|status|test"; exit 1 ;;
esac

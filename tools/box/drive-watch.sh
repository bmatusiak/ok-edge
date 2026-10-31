#!/bin/bash
# The box screen's live view of a drive (Brad, 2026-10-31: "i hate being blind, and not seeing activity"): everything
# the driver prints (logs/drive-live.log) and every line the session presser sees and presses
# (logs/drive-session-current.log, a link drive.sh moves to each new session), full, as it is written.
# Opened by drive.sh in a terminal on DISPLAY=:10.
L=~/project/onlykey/logs
touch "$L/drive-live.log"
echo "== drive: live (logs/drive-live.log + the session presser) =="
tail -n 40 -F "$L/drive-live.log" "$L/drive-session-current.log" 2>/dev/null

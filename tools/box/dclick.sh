#!/bin/bash
# Click the ok-edge desktop window at points given in SCREENSHOT coordinates (the 920x800+505+200 crop, scaled 75%),
# in order, then save a screenshot of that crop to /tmp/okd.png. A "wait:N" argument sleeps N seconds between clicks;
# a "type:TEXT" argument types TEXT; a "key:NAME" argument presses a key.
export DISPLAY=:10
# the window where the coordinates expect it (a window manager can move it): its frame's top-left at 505,200
W=$(xdotool search --name '^ok-edge$' | head -1)
[ -n "$W" ] && xdotool windowmove --sync "$W" 505 200 2>/dev/null
for a in "$@"; do
  case "$a" in
    wait:*) sleep "${a#wait:}" ;;
    type:*) xdotool type --delay 40 -- "${a#type:}" ;;
    key:*) xdotool key "${a#key:}" ;;
    *,*) x=${a%,*}; y=${a#*,}
         xdotool mousemove $((505 + x * 4 / 3)) $((200 + y * 4 / 3)) click 1; sleep 1 ;;
  esac
done
sleep 1.5
import -window root -crop 920x800+505+200 -resize 75% /tmp/okd.png

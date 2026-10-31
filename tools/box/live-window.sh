#!/bin/bash
# ONE live window per title on the box screen (DISPLAY=:10) - reused, never duplicated (Brad, 2026-10-31: "your (live)
# window never gets reused, or closed when starting a new one, so it just duplicates itself"). xfce4-terminal handed
# every new window to its running server process and exited, so the pid kept for a window was dead at once: each start
# opened another, and a stop closed none. Windows are found by their exact title (xdotool), and each is its own process
# (--disable-server).
#   bash tools/box/live-window.sh open "<title>" "<command>"   reuse the window with that title, or open it
#   bash tools/box/live-window.sh close "<title>"              close every window with that title
export DISPLAY=:10 XAUTHORITY=$HOME/.Xauthority
action=$1; title=$2; cmd=$3
re="^$(printf '%s' "$title" | sed 's/[][()\.*^$+?{}|]/\\&/g')\$"
ids=$(xdotool search --name "$re" 2>/dev/null)
case "$action" in
  open)
    if [ -n "$ids" ]; then echo "window \"$title\": reused"; exit 0; fi
    setsid xfce4-terminal --disable-server --title "$title" --geometry 150x45 -e "$cmd" > /dev/null 2>&1 < /dev/null &
    echo "window \"$title\": opened (pid $!)" ;;
  close)
    for w in $ids; do xdotool windowclose "$w" 2>/dev/null; done
    echo "window \"$title\": closed $(echo $ids | wc -w)" ;;
  *) echo "usage: live-window.sh open|close <title> [command]"; exit 2 ;;
esac

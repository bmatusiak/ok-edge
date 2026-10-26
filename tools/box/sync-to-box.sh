#!/bin/bash
# Run on WINDOWS (Git Bash): bring the box's clones to this machine's committed heads - git bundles, fast-forward only
# (never a stash or merge on the box). Windows stays the git home (pushes go from here); the box builds and runs.
#   ok-edge/tools/box/sync-to-box.sh [lib] [edge] [emu]     (default: all three)
set -e
BOX=bmatusiak@192.168.51.113
HERE=$(cd "$(dirname "$0")/../../.." && pwd)
want=${*:-lib edge emu}
for n in $want; do
  case $n in
    lib) d=node-onlykey-lib; b=master ;;
    edge) d=ok-edge; b=main ;;
    emu) d=node-onlykey-emulator; b=master ;;
    *) echo "unknown: $n"; exit 1 ;;
  esac
  git -C "$HERE/$d" bundle create "/tmp/$n.bundle" "$b" >/dev/null 2>&1
  scp -q "/tmp/$n.bundle" "$BOX:/tmp/$n.bundle"
  ssh $BOX "cd ~/project/onlykey/$d && git fetch -q /tmp/$n.bundle +$b:refs/remotes/windows/$b && git merge -q --ff-only windows/$b && echo \"$d \$(git rev-parse --short HEAD)\" && echo \"\$(date -Is) sync-to-box: $d \$(git rev-parse --short HEAD)\" >> ~/project/onlykey/steps.log" </dev/null
done

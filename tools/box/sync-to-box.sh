#!/bin/bash
# Run on WINDOWS (Git Bash): bring the box's clones to this machine's committed heads - git bundles, fast-forward only
# (never a stash or merge on the box). Windows stays the git home (pushes go from here); the box builds and runs.
#   ok-edge/tools/box/sync-to-box.sh [--after-ship] [lib] [edge] [emu]     (default: all three)
# --after-ship: a ship re-signs the commits, so the pushed head is not a fast-forward of the box's unsigned line. The
# box's branch is moved to the signed head ONLY when the box's files are those of a commit on the signed line
# (re-signing changes no file; the box may be behind) - anything else is work the box has that Windows does not, and
# the move is refused.
set -e
BOX=bmatusiak@192.168.51.113
HERE=$(cd "$(dirname "$0")/../../.." && pwd)
take='git merge -q --ff-only windows/$b'
if [ "$1" = "--after-ship" ]; then
  shift
  take='{ git log --format=%T windows/$b | grep -qx $(git rev-parse HEAD^{tree}) || { echo "$d: the box head matches no signed commit - not moved"; exit 1; }; git checkout -q -B $b windows/$b; }'
fi
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
  ssh $BOX "b=$b; d=$d; cd ~/project/onlykey/$d && git fetch -q /tmp/$n.bundle +$b:refs/remotes/windows/$b && $take && echo \"$d \$(git rev-parse --short HEAD)\" && echo \"\$(date -Is) sync-to-box: $d \$(git rev-parse --short HEAD)\" >> ~/project/onlykey/steps.log" </dev/null
done

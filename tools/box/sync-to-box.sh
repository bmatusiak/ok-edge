#!/bin/bash
# Run on WINDOWS (Git Bash): bring the box's clones to this machine's committed heads - git bundles, fast-forward only
# (never a stash or merge on the box). Windows stays the git home (pushes go from here); the box builds and runs.
#   ok-edge/tools/box/sync-to-box.sh [--after-ship] [lib] [edge] [emu] [kit]     (default: all four)
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
want=${*:-lib edge emu kit}
for n in $want; do
  case $n in
    lib) d=node-onlykey-lib; b=master ;;
    edge) d=ok-edge; b=main ;;
    emu) d=node-onlykey-emulator; b=master ;;
    kit) d=onlykey-testing; b=main ;;
    *) echo "unknown: $n"; exit 1 ;;
  esac
  git -C "$HERE/$d" bundle create "/tmp/$n.bundle" "$b" >/dev/null 2>&1
  scp -q "/tmp/$n.bundle" "$BOX:/tmp/$n.bundle"
  ssh $BOX "b=$b; d=$d; cd ~/project/onlykey/$d && git fetch -q /tmp/$n.bundle +$b:refs/remotes/windows/$b && $take && echo \"$d \$(git rev-parse --short HEAD)\" && echo \"\$(date -Is) sync-to-box: $d \$(git rev-parse --short HEAD)\" >> ~/project/onlykey/steps.log" </dev/null
done
# THE APP RUNS ITS OWN COPY OF THE LIB (memory box-gets-every-lib-commit: 2026-11-03 a box run tested a copy one commit
# behind): after the lib, every file changed since ok-edge's pin (package.json) goes into the box's
# ok-edge/node_modules/node-onlykey-lib - tests skipped, a file already the same left alone
case " $want " in *" lib "*)
  ssh $BOX 'cd ~/project/onlykey && pin=$(grep -o "node-onlykey-lib#[0-9a-f]*" ok-edge/package.json | cut -d"#" -f2) && n=0 && for f in $(git -C node-onlykey-lib diff --name-only "$pin"..HEAD | grep -v /test/); do [ -f "node-onlykey-lib/$f" ] || continue; cmp -s "node-onlykey-lib/$f" "ok-edge/node_modules/node-onlykey-lib/$f" && continue; mkdir -p "$(dirname "ok-edge/node_modules/node-onlykey-lib/$f")"; cp "node-onlykey-lib/$f" "ok-edge/node_modules/node-onlykey-lib/$f"; n=$((n+1)); done; echo "the lib copy in ok-edge/node_modules: $n file(s) from ${pin:0:7}..$(git -C node-onlykey-lib rev-parse --short HEAD)"' </dev/null
  # THE STAND-IN SERVES THE LIB'S MCP AND ROOMS (2026-11-04: it ran the MCP from before card_new - "no tool card_new"):
  # ended here, so the next app start (targets.js ensureStandin) brings it back on the new code
  ssh $BOX 'p=$(cat ~/project/onlykey/standin.pid 2>/dev/null) && kill "$p" 2>/dev/null && echo "the stand-in server (pid $p) ended - the next app start brings it back on this lib"' </dev/null || true
esac

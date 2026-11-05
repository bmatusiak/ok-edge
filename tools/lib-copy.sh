#!/bin/bash
# THE APP RUNS ITS OWN COPY OF THE LIB: ok-edge/node_modules/node-onlykey-lib is installed at the pin in package.json, and
# the lib's later commits reach the app only when copied in. This copies every file changed since the pin (tests left out,
# a file already the same left alone) from the lib checkout beside ok-edge - on whichever machine runs it.
#   bash ok-edge/tools/lib-copy.sh            (Windows: Git Bash; the box: sync-to-box.sh runs it there)
# Found 2026-11-04: the box got every lib commit through sync-to-box.sh, Windows none - its desktop app ran the pinned lib
# under fixes made and tested that day (memory box-gets-every-lib-commit, now both machines).
set -e
root="$(cd "$(dirname "$0")/../.." && pwd)"
lib="$root/node-onlykey-lib"
copy="$root/ok-edge/node_modules/node-onlykey-lib"
pin=$(grep -o 'node-onlykey-lib#[0-9a-f]*' "$root/ok-edge/package.json" | cut -d'#' -f2)
[ -n "$pin" ] && [ -d "$lib/.git" ] && [ -d "$copy" ] || { echo "lib-copy: no pin, no lib checkout at $lib, or no copy at $copy"; exit 1; }
n=0
for f in $(git -C "$lib" diff --name-only "$pin"..HEAD | grep -v /test/); do
  [ -f "$lib/$f" ] || continue
  cmp -s "$lib/$f" "$copy/$f" && continue
  mkdir -p "$(dirname "$copy/$f")"
  cp "$lib/$f" "$copy/$f"
  n=$((n+1))
done
echo "the lib copy in ok-edge/node_modules: $n file(s) from ${pin:0:7}..$(git -C "$lib" rev-parse --short HEAD)"

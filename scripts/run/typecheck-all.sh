#!/usr/bin/env bash
# Every package's typecheck in one pass, one line per package; exit 1 if any fails.
set -u
cd "$(dirname "$0")/../.." || exit 1
status=0
for p in site ui web-miner web-stats web-landing miner-core deploy; do
  if [ -f "packages/$p/package.json" ] && grep -q '"typecheck"' "packages/$p/package.json"; then
    if out=$(bun run --cwd "packages/$p" typecheck 2>&1); then
      echo "$p: ok"
    else
      echo "$p: FAIL"
      echo "$out" | grep -E "error TS" | head -20
      status=1
    fi
  fi
done
exit $status

#!/bin/zsh
# Usage: run-e2e2.sh <worktree> <outdir> <suite...>; "default" means the root playwright.config.ts.
setopt nullglob
WT=$1; OUT=$2; shift 2
mkdir -p $OUT; cd $WT || exit 1
SUM=$OUT/summary.txt; : > $SUM
[ -n "$SKIP_BUILD" ] || { pnpm build > $OUT/build.log 2>&1; echo "build exit $? $(date +%T)" >> $SUM; }
for s in "$@"; do
  if [ "$s" = "default" ]; then cfg=playwright.config.ts; else cfg=playwright.$s.config.ts; fi
  pnpm exec playwright test --config $cfg --reporter=line ${=EXTRA} > $OUT/$s.log 2>&1
  code=$?
  echo "$s exit $code $(date +%T) :: $(grep -E '^\s+[0-9]+ (passed|failed|flaky|skipped|did not run)' $OUT/$s.log | tr -s ' ' | tr '\n' ';')" >> $SUM
  if [ $code -ne 0 ]; then rm -rf $OUT/artifacts-$s; mkdir -p $OUT/artifacts-$s; cp -R test-results/playwright $OUT/artifacts-$s/ 2>/dev/null; fi
done
echo "ALL DONE $(date +%T)" >> $SUM

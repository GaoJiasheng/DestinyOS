#!/bin/zsh
set -u
ROOT=/Users/gavin/work/DestinyOS; R=$ROOT/.codex-runs; PL=$R/pipeline.log
log(){ echo "$(date '+%m-%d %H:%M') $*" >> $PL }
run_one(){ local n=$1 d=$2; cat $R/common.md $R/$n.md > $R/$n.prompt.md; local before=$(git -C $d rev-parse HEAD); $R/run.sh $n $R/$n.prompt.md $d; local after=$(git -C $d rev-parse HEAD)
  if [[ "$before" == "$after" || "$(tail -1 $R/$n.log)" != "EXIT=0" ]]; then log "retry $n"; { cat $R/common.md $R/$n.md; echo; echo "注意：上一轮未完成（日志尾部见下），请检查工作区现状，继续完成剩余部分、通过全部检查并提交。"; echo '```'; tail -40 $R/$n.log | cut -c1-300; echo '```'; } > $R/$n.prompt.md; $R/run.sh ${n}_retry $R/$n.prompt.md $d; fi
  log "done $n -> $(git -C $d log --oneline | head -1)"; }
merge_branches(){ export BRANCHES="$*"; cat $R/common.md $R/merge.md > $R/merge.prompt.md; echo "BRANCHES=$BRANCHES" >> $R/merge.prompt.md; $R/run.sh merge_$(date +%m%d%H%M) $R/merge.prompt.md $ROOT; log "merged $BRANCHES -> $(git -C $ROOT log --oneline | head -1)"; }
par(){ local names=($@) pids=() brs=(); for n in $names; do local d=$ROOT-wt-$n; git -C $ROOT worktree add -q $d -b wt/$n 2>/dev/null || true; cp $ROOT/apps/web/.env.local $d/apps/web/.env.local 2>/dev/null; (cd $d && pnpm install --silent >/dev/null 2>&1); run_one $n $d & pids+=($!); brs+=(wt/$n); done; wait $pids; merge_branches $brs; for n in $names; do git -C $ROOT worktree remove --force $ROOT-wt-$n 2>/dev/null; git -C $ROOT branch -D wt/$n >/dev/null 2>&1; done }
seq(){ for n in $@; do run_one $n $ROOT; done }
while [ ! -f $R/DONE ]; do sleep 60; done
rm -f $R/DONE; log "pipeline4 start"
seq f_cloudflare
par seo_content chat_eval journal
par a11y_perf simplify
seq final4
log "pipeline4 end"; touch $R/DONE4

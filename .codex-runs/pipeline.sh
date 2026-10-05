#!/bin/zsh
# 自动流水线：stage 列表，seq 在 main 跑；par 在 worktree 并行跑后合并
set -u
ROOT=/Users/gavin/work/DestinyOS; R=$ROOT/.codex-runs; PL=$R/pipeline.log
log(){ echo "$(date '+%m-%d %H:%M') $*" >> $PL }
run_one(){ # name dir
  local n=$1 d=$2
  cat $R/common.md $R/$n.md > $R/$n.prompt.md
  local before=$(git -C $d rev-parse HEAD)
  $R/run.sh $n $R/$n.prompt.md $d
  local after=$(git -C $d rev-parse HEAD)
  if [[ "$before" == "$after" || "$(tail -1 $R/$n.log)" != "EXIT=0" ]]; then
    log "retry $n"
    { cat $R/common.md $R/$n.md; echo; echo "注意：上一轮未完成（日志尾部见下），请检查工作区现状，继续完成剩余部分、通过全部检查并提交。"; echo '```'; tail -40 $R/$n.log | cut -c1-300; echo '```'; } > $R/$n.prompt.md
    $R/run.sh ${n}_retry $R/$n.prompt.md $d
  fi
  log "done $n -> $(git -C $d log --oneline | head -1)"
}
merge_branches(){ # branches...
  export BRANCHES="$*"
  cat $R/common.md $R/merge.md > $R/merge.prompt.md
  echo "BRANCHES=$BRANCHES" >> $R/merge.prompt.md
  $R/run.sh merge_$(date +%H%M) $R/merge.prompt.md $ROOT
  log "merged $BRANCHES -> $(git -C $ROOT log --oneline | head -1)"
}
par(){ # names...
  local names=($@) pids=() brs=()
  for n in $names; do
    local d=$ROOT-wt-$n
    git -C $ROOT worktree add -q $d -b wt/$n 2>/dev/null || true
    (cd $d && pnpm install --silent >/dev/null 2>&1)
    run_one $n $d & pids+=($!); brs+=(wt/$n)
  done
  wait $pids
  merge_branches $brs
  for n in $names; do git -C $ROOT worktree remove --force $ROOT-wt-$n 2>/dev/null; done
}
seq(){ for n in $@; do run_one $n $ROOT; done }

log "pipeline start"
# 阶段 0：等待已在跑的四个引擎 worktree 结束并合并
for t in t11 t12_15 t13_14 t16; do while ! grep -q '^EXIT=' $R/$t.log 2>/dev/null; do sleep 60; done; done
merge_branches wt/t11 wt/t12_15 wt/t13_14 wt/t16 wt/interp
for n in t11 t12_15 t13_14 t16 interp; do git -C $ROOT worktree remove --force $ROOT-wt-$n 2>/dev/null; done
seq t17_18
par c_bazi c_ziwei c_iching c_qimen t04_06
par c_tarot c_astrology c_vedic c_daily
seq t30_32
par t33 t34 t35 t36 t37
seq t38_44 t39_42 m4 m5 final
log "pipeline end"
touch $R/DONE

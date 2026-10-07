#!/bin/zsh
set -u
ROOT=/Users/gavin/work/DestinyOS; R=$ROOT/.codex-runs; PL=$R/pipeline.log
log(){ echo "$(date '+%m-%d %H:%M') $*" >> $PL }
attempt(){ # name promptfile -> runs, waits out usage limits (max 16 waits = 4h)
  local n=$1 p=$2 waits=0
  while true; do
    $R/run.sh $n $p $ROOT
    if grep -q -i 'usage limit' $R/$n.log && [[ "$(tail -1 $R/$n.log)" != "EXIT=0" ]]; then
      (( waits++ )); [[ $waits -gt 16 ]] && { log "give up $n (usage limit)"; return 1; }
      log "usage limit on $n, waiting 15m ($waits)"; sleep 900; continue
    fi
    return 0
  done
}
run_one(){ local n=$1; local extra=${2:-}
  { cat $R/common.md $R/$n.md; [[ -n $extra ]] && echo "\n$extra"; } > $R/$n.prompt.md
  local before=$(git -C $ROOT rev-parse HEAD)
  attempt $n $R/$n.prompt.md
  local after=$(git -C $ROOT rev-parse HEAD)
  if [[ "$before" == "$after" || "$(tail -1 $R/$n.log)" != "EXIT=0" ]]; then
    log "retry $n"
    { cat $R/common.md $R/$n.md; echo; echo "注意：上一轮未完成（日志尾部见下），请检查工作区现状，继续完成剩余部分、通过全部检查并提交。"; echo '```'; tail -40 $R/$n.log | cut -c1-300; echo '```'; } > $R/$n.prompt.md
    attempt ${n}_retry $R/$n.prompt.md
  fi
  log "done $n -> $(git -C $ROOT log --oneline | head -1)"; }
log "pipeline_app3 start"
run_one app_M13 "注意：上一轮 M13 因额度中断，工作区里已有未提交的部分实现（git status 可见），请在其基础上继续完成，不要推倒重来。"
for n in app_M14 app_M15 app_final; do run_one $n; done
log "pipeline_app3 end"; touch $R/DONE_APP

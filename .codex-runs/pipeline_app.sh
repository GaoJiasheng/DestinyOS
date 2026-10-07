#!/bin/zsh
set -u
ROOT=/Users/gavin/work/DestinyOS; R=$ROOT/.codex-runs; PL=$R/pipeline.log
log(){ echo "$(date '+%m-%d %H:%M') $*" >> $PL }
run_one(){ local n=$1; cat $R/common.md $R/$n.md > $R/$n.prompt.md; local before=$(git -C $ROOT rev-parse HEAD); $R/run.sh $n $R/$n.prompt.md $ROOT; local after=$(git -C $ROOT rev-parse HEAD)
  if [[ "$before" == "$after" || "$(tail -1 $R/$n.log)" != "EXIT=0" ]]; then log "retry $n"; { cat $R/common.md $R/$n.md; echo; echo "注意：上一轮未完成（日志尾部见下），请检查工作区现状，继续完成剩余部分、通过全部检查并提交。"; echo '```'; tail -40 $R/$n.log | cut -c1-300; echo '```'; } > $R/$n.prompt.md; $R/run.sh ${n}_retry $R/$n.prompt.md $ROOT; fi
  log "done $n -> $(git -C $ROOT log --oneline | head -1)"; }
while ! grep -q '^EXIT=' $R/cf_email.log 2>/dev/null; do sleep 60; done
log "pipeline_app start"
for n in cf_slim web_pricing app_M01 app_M02 app_M03 app_M04 app_M05 app_M06 app_M07 app_M08 app_M09 app_M10 app_M11 app_M12 app_M13 app_M14 app_M15 app_final; do run_one $n; done
log "pipeline_app end"; touch $R/DONE_APP

#!/bin/zsh
set -u
ROOT=/Users/gavin/work/DestinyOS; R=$ROOT/.codex-runs; PL=$R/pipeline.log
log(){ echo "$(date '+%m-%d %H:%M') $*" >> $PL }
run_one(){ local n=$1; cat $R/common.md $R/$n.md > $R/$n.prompt.md; local before=$(git -C $ROOT rev-parse HEAD); $R/run.sh $n $R/$n.prompt.md $ROOT; local after=$(git -C $ROOT rev-parse HEAD)
  if [[ "$before" == "$after" || "$(tail -1 $R/$n.log)" != "EXIT=0" ]]; then log "retry $n"; { cat $R/common.md $R/$n.md; echo; echo "注意：上一轮未完成（日志尾部见下），请检查工作区现状，继续完成剩余部分、通过全部检查并提交。"; echo '```'; tail -40 $R/$n.log | cut -c1-300; echo '```'; } > $R/$n.prompt.md; $R/run.sh ${n}_retry $R/$n.prompt.md $ROOT; fi
  log "done $n -> $(git -C $ROOT log --oneline | head -1)"; }
rm -f $R/DONE; log "pipeline2 start"
cp $R/final.md $R/final2.md
for n in final polish final2; do run_one $n; done
log "pipeline2 end"; touch $R/DONE

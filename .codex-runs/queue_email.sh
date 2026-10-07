#!/bin/zsh
R=/Users/gavin/work/DestinyOS/.codex-runs
while ! grep -q '^EXIT=' $R/cf_native.log 2>/dev/null; do sleep 60; done
cat $R/common.md $R/cf_email.md > $R/cf_email.prompt.md
$R/run.sh cf_email $R/cf_email.prompt.md /Users/gavin/work/DestinyOS

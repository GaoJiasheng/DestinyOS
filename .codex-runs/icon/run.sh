#!/bin/zsh
# usage: run.sh <slug> <subject>
D=/Users/gavin/work/DestinyOS/.codex-runs/icon
slug=$1; subject=$2
mkdir -p $D/$slug
prompt="Use the image generation tool to generate ONE square image (1024x1024) and save it as $slug.png in the current working directory. SUBJECT: $subject $(cat $D/brief.txt) Reply with the absolute path only."
codex exec --skip-git-repo-check -C $D/$slug "$prompt" < /dev/null > $D/$slug/codex.log 2>&1
echo "$slug exit $? $(ls $D/$slug/*.png 2>/dev/null | tr '\n' ' ')"

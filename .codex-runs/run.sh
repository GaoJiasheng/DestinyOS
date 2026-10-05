#!/bin/zsh
# usage: run.sh <name> <prompt-file> [workdir]
set -u
NAME=$1; PROMPT=$2; DIR=${3:-/Users/gavin/work/DestinyOS}
LOG=/Users/gavin/work/DestinyOS/.codex-runs/$NAME.log
cd "$DIR"
codex exec --sandbox danger-full-access -m gpt-6.1-sol --skip-git-repo-check -c model_reasoning_effort='"high"' - < "$PROMPT" > "$LOG" 2>&1
echo "EXIT=$?" >> "$LOG"

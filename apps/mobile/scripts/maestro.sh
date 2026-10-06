#!/usr/bin/env bash
set -euo pipefail
mobile_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
evidence_dir="$mobile_root/test-results/M01"
mkdir -p "$evidence_dir/maestro"
run_dir="$(mktemp -d "$evidence_dir/maestro/run.XXXXXX")"
maestro "$@" test "$mobile_root/maestro/M01.yaml" --test-output-dir "$run_dir" --no-ansi
# Maestro nests artifacts by run and flow; publish only this run's requested screenshots.
find "$run_dir" -type f -path '*/takeScreenshot/*.png' -exec cp {} "$evidence_dir/" \;

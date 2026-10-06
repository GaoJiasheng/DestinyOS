#!/usr/bin/env bash
set -euo pipefail
mobile_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
device="${1:-E35A99F1-F6C1-4BF8-8EED-018CDDB93917}"
flow="${2:-M07-tarot}"
evidence="$mobile_root/test-results/M07"
mkdir -p "$evidence/maestro"
run_dir="$(mktemp -d "$evidence/maestro/run-XXXXXX")"
maestro --device "$device" test "$mobile_root/maestro/$flow.yaml" --test-output-dir "$run_dir" --no-ansi
find "$run_dir" -type f -path '*/takeScreenshot/*.png' -exec cp {} "$evidence/" \;

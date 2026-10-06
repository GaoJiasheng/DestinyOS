#!/usr/bin/env bash
set -euo pipefail
# Run Metro first: pnpm --filter @tianji/mobile exec expo start --lan --port 8081.
mobile_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
device="${1:-E35A99F1-F6C1-4BF8-8EED-018CDDB93917}"
flow="${2:-M06}"
evidence="$mobile_root/test-results/M06"
mkdir -p "$evidence/maestro"
run_dir="$(mktemp -d "$evidence/maestro/run-XXXXXX")"
maestro --device "$device" test "$mobile_root/maestro/$flow.yaml" --test-output-dir "$run_dir" --no-ansi
find "$run_dir" -type f -path '*/takeScreenshot/*.png' -exec cp {} "$evidence/" \;

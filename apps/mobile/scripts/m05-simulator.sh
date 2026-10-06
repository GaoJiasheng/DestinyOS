#!/usr/bin/env bash
set -euo pipefail
mobile_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
device="${1:-E35A99F1-F6C1-4BF8-8EED-018CDDB93917}"
evidence="$mobile_root/test-results/M05"
mkdir -p "$evidence/maestro"
run_dir="$(mktemp -d "$evidence/maestro/run-XXXXXX")"
# DESIGN-GAP: Release acceptance runs with the embedded bundle and no Metro dependency;
# debug acceptance needs `expo start --lan --port 8081` (iOS resolves localhost to IPv4).
variant="${2:-debug}"
flow="${3:-M05}"
dev_mode=1
if [[ "$variant" == release ]]; then dev_mode=0; fi
maestro --device "$device" test -e "M05_DEV=$dev_mode" "$mobile_root/maestro/$flow.yaml" --test-output-dir "$run_dir" --no-ansi
find "$run_dir" -type f -path '*/takeScreenshot/*.png' -exec cp {} "$evidence/" \;

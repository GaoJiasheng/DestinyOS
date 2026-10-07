#!/usr/bin/env bash
set -euo pipefail
mobile_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
device="${1:?Pass the dedicated M11 simulator UDID}"
evidence="$mobile_root/test-results/M11"
mkdir -p "$evidence/maestro"
run_dir="$(mktemp -d "$evidence/maestro/widgets-XXXXXX")"
maestro_bin="$(command -v maestro)"
export PATH="$(dirname "$maestro_bin"):${JAVA_HOME:+$JAVA_HOME/bin:}/usr/bin:/bin:/usr/sbin:/sbin"
"$maestro_bin" --device "$device" test "$mobile_root/maestro/M11-widget-gallery.yaml" --test-output-dir "$run_dir" --no-ansi
find "$run_dir" -type f -path '*/takeScreenshot/*.png' -exec cp {} "$evidence/" \;

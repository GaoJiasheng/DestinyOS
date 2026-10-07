#!/usr/bin/env bash
set -euo pipefail
mobile_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
device="${1:?Pass a dedicated iOS simulator UDID with the M14 Release audit build}"
flow="${2:-M14}"
case "$flow" in M14|M14-accessibility) ;; *) exit 1 ;; esac
evidence="$mobile_root/test-results/M14"
mkdir -p "$evidence/maestro"
run_dir="$(mktemp -d "$evidence/maestro/run-XXXXXX")"
maestro_bin="$(command -v maestro)"
# DESIGN-GAP: Use Maestro's existing JVM while preventing Android toolchain probing; never install Java for Android.
export PATH="$(dirname "$maestro_bin"):${JAVA_HOME:+$JAVA_HOME/bin:}/usr/bin:/bin:/usr/sbin:/sbin"
"$maestro_bin" --device "$device" test "$mobile_root/maestro/$flow.yaml" --test-output-dir "$run_dir" --no-ansi
find "$run_dir" -type f -path '*/takeScreenshot/*.png' -exec cp {} "$evidence/" \;
container="$(xcrun simctl get_app_container "$device" pub.gavin.tianji data)"
if [[ "$flow" == M14 ]]; then
  cp "$container"/Documents/M14-starfield.json "$container"/Documents/M14-history.json "$evidence/"
else
  cp "$container"/Documents/M14-accessibility.json "$evidence/accessibility-large-text-reduced.json"
fi

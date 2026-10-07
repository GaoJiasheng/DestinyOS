#!/usr/bin/env bash
set -euo pipefail
mobile_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
device="${1:?Pass the dedicated M11 simulator UDID}"
flow="${2:-M11}"
evidence="$mobile_root/test-results/M11"
mkdir -p "$evidence/maestro"
run_dir="$(mktemp -d "$evidence/maestro/run-XXXXXX")"
# DESIGN-GAP: Maestro's environment probe can hang on an unrelated Flutter install.
# Use its existing JVM and Apple system tools only; this does not install a Java toolchain.
maestro_bin="$(command -v maestro)"
export PATH="$(dirname "$maestro_bin"):${JAVA_HOME:+$JAVA_HOME/bin:}/usr/bin:/bin:/usr/sbin:/sbin"
"$maestro_bin" --device "$device" test "$mobile_root/maestro/$flow.yaml" --test-output-dir "$run_dir" --no-ansi
find "$run_dir" -type f -path '*/takeScreenshot/*.png' -exec cp {} "$evidence/" \;

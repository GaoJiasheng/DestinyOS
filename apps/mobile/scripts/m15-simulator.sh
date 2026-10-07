#!/usr/bin/env bash
set -euo pipefail
mobile_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
device="${1:?Pass a dedicated simulator ID with the development app installed}"
size="${2:?iphone-6.9, iphone-6.5 or android-phone}"
locale="${3:-zh}"
case "$size" in iphone-6.9|iphone-6.5|android-phone) ;; *) exit 1 ;; esac
case "$locale" in zh|en|zh-TW) ;; *) exit 1 ;; esac
evidence="$mobile_root/test-results/M15/raw/$size/$locale"
mkdir -p "$evidence"
run_dir="$(mktemp -d "$mobile_root/test-results/M15/maestro-XXXXXX")"
if [[ "$size" == iphone-* ]]; then
  xcrun simctl status_bar "$device" override --time '9:41' --dataNetwork wifi --wifiMode active --wifiBars 3 --batteryState charged --batteryLevel 100
  trap 'xcrun simctl status_bar "$device" clear' EXIT
fi
# DESIGN-GAP: Reuse Maestro's already-provisioned JVM for Apple automation, without installing an Android toolchain.
maestro_bin="$(command -v maestro)"
if [[ "$size" == iphone-* ]]; then
  export PATH="$(dirname "$maestro_bin"):${JAVA_HOME:+$JAVA_HOME/bin:}/usr/bin:/bin:/usr/sbin:/sbin"
fi
"$maestro_bin" --device "$device" test "$mobile_root/maestro/M15.yaml" -e LOCALE="$locale" --test-output-dir "$run_dir" --no-ansi
find "$run_dir" -type f -path '*/takeScreenshot/*.png' -exec cp {} "$evidence/" \;

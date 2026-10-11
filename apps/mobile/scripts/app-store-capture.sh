#!/usr/bin/env bash
set -euo pipefail
mobile_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
device="${1:?Pass a dedicated simulator UDID}"
size="${2:?6.9 or 6.5}"
phase="${3:-capture}"
case "$size" in 6.9|6.5) ;; *) exit 2 ;; esac
case "$phase" in prepare|capture|today|systems|profile-label) ;; *) exit 2 ;; esac
maestro_bin="$(command -v maestro)"
# DESIGN-GAP: Use Maestro's pre-existing JVM for iOS automation; never install Java or invoke Android build tools.
export PATH="$(dirname "$maestro_bin"):${JAVA_HOME:+$JAVA_HOME/bin:}/usr/bin:/bin:/usr/sbin:/sbin"
installed_app="$(xcrun simctl get_app_container "$device" pub.gavin.tianji app)"
/usr/bin/python3 - "$installed_app" <<'PY'
import json,pathlib,sys
p=pathlib.Path(sys.argv[1]);c=json.loads((p/'EXConstants.bundle/app.config').read_text())
assert c['extra']['APP_VARIANT']=='production'
assert c['extra']['API_BASE_URL']=='https://tianji.gavin.pub'
assert (p/'main.jsbundle').exists()
PY
xcrun simctl status_bar "$device" override --time '9:41' --dataNetwork wifi --wifiMode active --wifiBars 3 --batteryState charged --batteryLevel 100
trap 'xcrun simctl status_bar "$device" clear' EXIT
if [[ "$phase" == prepare || "$phase" == profile-label ]]; then
  run_dir="$(mktemp -d "$mobile_root/test-results/IOS-STORE/prepare-$size-XXXXXX")"
  "$maestro_bin" --device "$device" test "$mobile_root/store/app-store/automation/$phase.yaml" --test-output-dir "$run_dir" --no-ansi
  exit
fi
for locale in en zh zh-TW; do
  case "$locale" in en) store_locale=en-US ;; zh) store_locale=zh-Hans ;; zh-TW) store_locale=zh-Hant ;; esac
  evidence="$mobile_root/test-results/IOS-STORE/raw/$store_locale/$size"
  mkdir -p "$evidence"
  run_dir="$(mktemp -d "$mobile_root/test-results/IOS-STORE/capture-$size-$locale-XXXXXX")"
  "$maestro_bin" --device "$device" test "$mobile_root/store/app-store/automation/$phase.yaml" -e LOCALE="$locale" --test-output-dir "$run_dir" --no-ansi
  find "$run_dir" -type f -path '*/takeScreenshot/*.png' -exec cp {} "$evidence/" \;
done

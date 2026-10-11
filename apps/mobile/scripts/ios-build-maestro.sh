#!/usr/bin/env bash
set -euo pipefail
mobile_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
device="${1:?Pass the dedicated IOS-BUILD simulator UDID}"
phase="${2:-onboarding}"
evidence="$mobile_root/test-results/ios-build"
mkdir -p "$evidence/maestro"
run_dir="$(mktemp -d "$evidence/maestro/$phase-XXXXXX")"
maestro_bin="$(command -v maestro)"
installed_app="$(xcrun simctl get_app_container "$device" pub.gavin.tianji app)"
# DESIGN-GAP: Reuse Maestro's installed JVM without installing Android Java or invoking Android SDK tools.
export PATH="$(dirname "$maestro_bin"):${JAVA_HOME:+$JAVA_HOME/bin:}/usr/bin:/bin:/usr/sbin:/sbin"
environment=()
if [[ "$phase" == account ]]; then
  # This local test entry substitutes email delivery only; do not persist or print the single-use credential.
  MAGIC_URL="$(curl -fsS -X POST http://127.0.0.1:8787/_smoke/mobile-magic | /usr/bin/python3 -c 'import json,sys; print(json.load(sys.stdin)["url"])')"
  environment=(-e "MAGIC_URL=$MAGIC_URL")
fi
"$maestro_bin" --device "$device" test ${environment[@]+"${environment[@]}"} "$mobile_root/maestro/ios-build/IOS-BUILD-$phase.yaml" --test-output-dir "$run_dir" --no-ansi
find "$run_dir" -type f -path '*/takeScreenshot/*.png' -exec cp {} "$evidence/" \;
# Persist only successful phase metadata and sanitized screenshot hashes; raw UI logs may contain single-use credentials.
/usr/bin/python3 - "$evidence" "$phase" "$device" "$mobile_root/maestro/ios-build/IOS-BUILD-$phase.yaml" "$installed_app" <<'PY'
import datetime, hashlib, json, pathlib, sys
root, phase, device, flow, installed_app = sys.argv[1:]
config = json.loads((pathlib.Path(installed_app) / "EXConstants.bundle/app.config").read_text())
root = pathlib.Path(root)
receipt = root / 'maestro-results.json'
result = json.loads(receipt.read_text()) if receipt.exists() else {'configuration': 'Release', 'phases': {}}
result['phases'][phase] = {'passed': True, 'device': device,
                          'variant': config['extra']['APP_VARIANT'], 'apiBaseUrl': config['extra']['API_BASE_URL'],
                          'checkedAt': datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z'),
                          'flowSha256': hashlib.sha256(pathlib.Path(flow).read_bytes()).hexdigest()}
result['flowDependencies'] = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(pathlib.Path(flow).parent.glob('*.yaml'))}
result['screenshots'] = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(root.glob('*.png'))}
receipt.write_text(json.dumps(result, indent=2) + '\n')
PY

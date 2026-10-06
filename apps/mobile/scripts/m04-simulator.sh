#!/usr/bin/env bash
set -euo pipefail
mobile_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
device="${1:-E35A99F1-F6C1-4BF8-8EED-018CDDB93917}"
evidence="$mobile_root/test-results/M04"
mkdir -p "$evidence/maestro"
run_dir="$(mktemp -d "$evidence/maestro/run-XXXXXX")"
maestro --device "$device" test "$mobile_root/maestro/M04.yaml" --test-output-dir "$run_dir" --no-ansi
container="$(xcrun simctl get_app_container "$device" pub.gavin.tianji data)"
cp "$container/Documents/M04-storage.json" "$evidence/"
find "$run_dir" -type f -path '*/takeScreenshot/*.png' -exec cp {} "$evidence/" \;
python3 - "$evidence/M04-storage.json" <<'PYCHECK'
import json, sys
result = json.load(open(sys.argv[1]))
assert result['passed'] and result['hermes'], result
assert result['cipher'], result
print('Native SQLCipher encryption, wrong-key rejection, restart persistence and deletion passed.')
PYCHECK

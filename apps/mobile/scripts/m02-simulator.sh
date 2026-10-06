#!/usr/bin/env bash
set -euo pipefail
mobile_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# DESIGN-GAP: Accept a simulator UUID to keep this task isolated from other booted devices.
device="${1:-E35A99F1-F6C1-4BF8-8EED-018CDDB93917}"
evidence="$mobile_root/test-results/M02"
mkdir -p "$evidence/maestro"
run_dir="$(mktemp -d "$evidence/maestro/run-XXXXXX")"
xcrun simctl io "$device" recordVideo --force --codec=h264 "$evidence/effects.mp4" >"$evidence/recording.log" 2>&1 &
recording_pid=$!
port_file="$(mktemp -t APP-M02-port)"
python3 "$mobile_root/scripts/frame-wait.py" "$device" "$port_file" &
waiter_pid=$!
trap 'kill -INT "$recording_pid" 2>/dev/null || true; kill "$waiter_pid" 2>/dev/null || true; rm -f "$port_file"' EXIT
while [[ ! -s "$port_file" ]]; do
  kill -0 "$waiter_pid" 2>/dev/null || exit 1
  sleep .1
done
maestro --device "$device" test -e "M02_PORT=$(cat "$port_file")" "$mobile_root/maestro/M02.yaml" --test-output-dir "$run_dir" --no-ansi
kill -INT "$recording_pid"
wait "$recording_pid" || true
kill "$waiter_pid"
wait "$waiter_pid" 2>/dev/null || true
rm -f "$port_file"
trap - EXIT
container="$(xcrun simctl get_app_container "$device" pub.gavin.tianji data)"
cp "$container"/Documents/M02-*.json "$evidence/"
find "$run_dir" -type f -path '*/takeScreenshot/*.png' -exec cp {} "$evidence/" \;

python3 - "$evidence" <<'PYCHECK'
import json, pathlib, sys
root = pathlib.Path(sys.argv[1])
engine = json.loads((root / 'M02-engine.json').read_text())
assert engine['passed'] and engine['hermes'], engine
catalog = json.loads((root / 'M02-catalog.json').read_text())
assert catalog['records'] == 9096, catalog
for name in ['starfield', 'sphere', 'particles', 'tarot', 'coins', 'wheel']:
    value = json.loads((root / f'M02-{name}.json').read_text())
    assert value['passed'] and value['fps'] + 1e-6 >= value['target'], value
    assert value['frames'] > 0 and value['durationMs'] >= 9900, value
print('Hermes correctness, <=300ms compute+interpret and six frame budgets passed.')
PYCHECK

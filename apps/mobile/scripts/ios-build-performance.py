#!/usr/bin/env python3
"""Measure actual Today UI display-link cadence with no Maestro observer."""
import datetime
import json
import pathlib
import subprocess
import sys
import time

simulator, output = sys.argv[1:3]
repo = pathlib.Path(__file__).resolve().parents[3]

def source_hash():
    return subprocess.check_output(['pnpm', 'exec', 'tsx', '-e', "import {launchNativeSourceHash} from './scripts/launch-source-hash.ts';launchNativeSourceHash().then(console.log)"], cwd=repo, text=True).strip()

def sim(*args):
    return subprocess.run(['xcrun', 'simctl', *args], check=True, capture_output=True, text=True).stdout.strip()

fingerprint = source_hash()
container = pathlib.Path(sim('get_app_container', simulator, 'pub.gavin.tianji', 'data'))
measurement = container / 'Documents/IOS-first-screen.json'
samples = []
for run in range(3):
    subprocess.run(['xcrun', 'simctl', 'terminate', simulator, 'pub.gavin.tianji'], capture_output=True)
    time.sleep(2)
    measurement.unlink(missing_ok=True)
    sim('launch', simulator, 'pub.gavin.tianji')
    deadline = time.monotonic() + 35
    while not measurement.exists():
        if time.monotonic() > deadline:
            raise RuntimeError('No first-screen frame measurement; use the integration Release, disable reduced motion and disconnect Maestro')
        time.sleep(0.05)
    samples.append({'run': run + 1, **json.loads(measurement.read_text())})
assert source_hash() == fingerprint, 'Native source changed during measurement'
# DESIGN-GAP: First screen uses the documented 55fps sky budget; UI cadence does not claim physical-device GPU completion.
result = {'configuration': 'Release', 'screen': 'today', 'observer': 'none', 'samples': samples,
          'budgetFps': 55, 'sourceHash': fingerprint,
          'checkedAt': datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z'),
          'passed': all(sample['fps'] >= 55 for sample in samples)}
root = pathlib.Path(output)
root.mkdir(parents=True, exist_ok=True)
(root / 'first-screen-performance.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
if not result['passed']:
    raise SystemExit(1)

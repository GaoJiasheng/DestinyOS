#!/usr/bin/env python3
"""Measure five independent process starts of an embedded Release build; no Metro timing."""
import json
import pathlib
import subprocess
import sys
import time

simulator, output = sys.argv[1:3]
root = pathlib.Path(output)
root.mkdir(parents=True, exist_ok=True)

def sim(*args):
    return subprocess.run(['xcrun', 'simctl', *args], check=True, capture_output=True, text=True).stdout.strip()

container = pathlib.Path(sim('get_app_container', simulator, 'pub.gavin.tianji', 'data'))
ready = container / 'Documents/M14-startup.json'
measurements = []
for run in range(5):
    subprocess.run(['xcrun', 'simctl', 'terminate', simulator, 'pub.gavin.tianji'], capture_output=True)
    ready.unlink(missing_ok=True)
    # DESIGN-GAP: Let SpringBoard finish process teardown before a new independent launch; termination is asynchronous.
    time.sleep(2)
    # DESIGN-GAP: Start before the host CLI invocation; this includes simctl overhead, conservatively above OS dispatch-to-ready time.
    launched = time.time() * 1000
    sim('launch', simulator, 'pub.gavin.tianji')
    deadline = time.monotonic() + 30
    while not ready.exists():
        if time.monotonic() > deadline:
            raise RuntimeError('No native ready frame within 30 seconds')
        time.sleep(0.02)
    sample = json.loads(ready.read_text())
    sample['launchToReadyMs'] = sample['readyAtUnixMs'] - launched
    measurements.append(sample)
    time.sleep(0.5)
result = {'platform': 'ios', 'configuration': 'Release', 'metro': False, 'samples': measurements,
          'maxMs': max(s['launchToReadyMs'] for s in measurements), 'budgetMs': 2000, 'teardownCooldownMs': 2000}
result['passed'] = result['maxMs'] <= result['budgetMs'] and all(s['hermes'] for s in measurements)
(root / 'cold-start.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
if not result['passed']:
    raise SystemExit(1)

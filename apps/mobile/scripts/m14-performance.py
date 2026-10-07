#!/usr/bin/env python3
"""Sample Release display cadence without accessibility-tree polling or screenshots."""
import json
import datetime
import pathlib
import subprocess
import sys
import time

simulator, output = sys.argv[1:3]

# DESIGN-GAP: Stamp real measurements with the current native source, outside timed windows.
repo = pathlib.Path(__file__).resolve().parents[3]
def source_hash():
    return subprocess.check_output(['pnpm', 'exec', 'tsx', '-e', "import {launchNativeSourceHash} from './scripts/launch-source-hash.ts';launchNativeSourceHash().then(console.log)"], cwd=repo, text=True).strip()
native_source_hash = source_hash()
root = pathlib.Path(output)
root.mkdir(parents=True, exist_ok=True)

def sim(*args):
    return subprocess.run(['xcrun', 'simctl', *args], check=True, capture_output=True, text=True).stdout.strip()

container = pathlib.Path(sim('get_app_container', simulator, 'pub.gavin.tianji', 'data'))
samples = []
# DESIGN-GAP: Start with a fresh audit route so an already-completed sky window cannot suppress the first measurement.
subprocess.run(['xcrun', 'simctl', 'terminate', simulator, 'pub.gavin.tianji'], capture_output=True)
time.sleep(2)
# DESIGN-GAP: Six 10s windows run after the UI automation client disconnects; do not attribute its tree inspection overhead to list rendering.
for run in range(3):
    for scene in ['starfield', 'history']:
        measurement = container / f'Documents/M14-{scene}.json'
        measurement.unlink(missing_ok=True)
        sim('openurl', simulator, f'tianji:///dev/audit?scene={scene}')
        deadline = time.monotonic() + 30
        while not measurement.exists():
            if time.monotonic() > deadline:
                raise RuntimeError(f'No {scene} measurement: disable reduced motion/readers before performance sampling')
            time.sleep(0.05)
        sample = json.loads(measurement.read_text())
        samples.append({'scene': scene, 'run': run + 1, **sample})
        time.sleep(0.5)
# DESIGN-GAP: M14 prescribes cold-start and sky budgets, not zero list deadline misses. Require responsive list cadence (55fps, P95 <=20ms, worst <=50ms) while retaining every >25ms interval for review.
result = {'configuration': 'Release', 'observer': 'none', 'samples': samples,
          'starfieldBudgetFps': 55, 'listBudgetFps': 55, 'listP95BudgetMs': 20,
          'listMaxFrameBudgetMs': 50, 'longFrameThresholdMs': 25}
assert source_hash() == native_source_hash, 'Native source changed during measurement'
result['sourceHash'] = native_source_hash
result['checkedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z')
result['passed'] = all(s['hermes'] and not s['reduced'] and not s['screenReader'] and
                       s['fps'] >= 55 and (s['scene'] == 'starfield' or
                       (s['p95Ms'] <= 20 and s['maxMs'] <= 50))
                       for s in samples)
(root / 'performance.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
if not result['passed']:
    raise SystemExit(1)

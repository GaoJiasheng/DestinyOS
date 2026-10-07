#!/usr/bin/env python3
"""Finalize a passed native run's recording and source-bound delivery evidence."""
import datetime
import hashlib
import json
import os
import pathlib
import shutil
import subprocess
import sys

repo = pathlib.Path(__file__).resolve().parents[3]
evidence = repo / 'apps/mobile/test-results/M02'
engine = json.loads((evidence / 'M02-engine.json').read_text())
assert engine['passed'] and engine['hermes'], 'Finalize only a passed Hermes run'
host_path = os.environ.get('MAESTRO_HOST_PATH', os.environ.get('PATH', ''))
ffmpeg = shutil.which('ffmpeg', path=host_path)
ffprobe = shutil.which('ffprobe', path=host_path)
pnpm = shutil.which('pnpm', path=host_path)
assert ffprobe and pnpm, 'Native evidence needs host ffprobe and pnpm'
movie = evidence / 'effects.mp4'
raw = repo / f'apps/mobile/test-results/launch/video/M02-{datetime.datetime.now().strftime("%Y%m%d-%H%M%S")}.mp4'
raw.parent.mkdir(parents=True, exist_ok=True)
shutil.copy2(movie, raw)
def sha(file):
    digest = hashlib.sha256()
    with file.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()
# DESIGN-GAP: Keep the original host recording locally; optional delivery encoding
# changes only its size, never the native measured frame rate or performance budget.
if ffmpeg:
    compressed = raw.with_name(raw.stem + '-delivery.mp4')
    subprocess.run([ffmpeg, '-y', '-i', str(raw), '-vf', 'scale=720:-2', '-c:v', 'libx264', '-preset', 'medium', '-crf', '26', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(compressed)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    shutil.copy2(compressed, movie)
source_hash = subprocess.check_output([pnpm, 'exec', 'tsx', '-e', "import {launchNativeSourceHash} from './scripts/launch-source-hash.ts';launchNativeSourceHash().then(console.log)"], cwd=repo, text=True).strip()
installed = pathlib.Path(subprocess.check_output(['xcrun', 'simctl', 'get_app_container', sys.argv[1], 'pub.gavin.tianji', 'app'], text=True).strip())
metadata = json.loads((evidence / 'run-metadata.json').read_text())
metadata.update(recordedAt=datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z'), sourceHash=source_hash, nativeBundleSha256=sha(installed / 'main.jsbundle'), rawRecordingSha256=sha(raw), recordingSha256=sha(movie), recordingDurationSeconds=float(subprocess.check_output([ffprobe, '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', str(movie)])), engineMaxMs=max(row['maxMs'] for row in engine['rows']), gl=json.loads((evidence / 'M02-gl.json').read_text()), hostCpu=subprocess.check_output(['sysctl', '-n', 'machdep.cpu.brand_string'], text=True).strip(), xcode=subprocess.check_output(['xcodebuild', '-version'], text=True).strip(), udid=sys.argv[1])
metadata['recording'] = 'simctl H.264 original; 720px libx264 CRF26 delivery' if ffmpeg else 'simctl H.264 original'
metadata['recording'] += '; encoded FPS is not an app FPS measurement'
(evidence / 'run-metadata.json').write_text(json.dumps(metadata, indent=2) + '\n')
print(json.dumps(metadata, indent=2))

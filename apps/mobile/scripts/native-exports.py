#!/usr/bin/env python3
"""Preserve original Skia cache PNGs while a successful share flow owns them."""
import datetime
import hashlib
import json
import pathlib
import signal
import struct
import subprocess
import sys
import time

device, prefix, width, height, directory = sys.argv[1:]
output = pathlib.Path(directory)
output.mkdir(parents=True, exist_ok=True)
started = time.time()
running = True
seen = set()

def stop(*_):
    global running
    running = False

signal.signal(signal.SIGTERM, stop)
signal.signal(signal.SIGINT, stop)
container = pathlib.Path(subprocess.check_output([
    'xcrun', 'simctl', 'get_app_container', device, 'pub.gavin.tianji', 'data',
], text=True).strip())
# DESIGN-GAP: Share components delete temporary images on close; preserve original
# bytes during the flow, then publish only after Maestro reports success.
while running:
    for file in sorted((container / 'Library/Caches').glob(prefix + '-*.png')):
        try:
            if file.name in seen or file.stat().st_mtime < started:
                continue
            data = file.read_bytes()
            if not data.startswith(b'\x89PNG\r\n\x1a\n') or not data.endswith(b'\x00\x00\x00\x00IEND\xaeB`\x82'):
                continue
            if struct.unpack('>II', data[16:24]) != (int(width), int(height)):
                continue
            (output / 'original.png').write_bytes(data)
            (output / 'capture.json').write_text(json.dumps({
                'sha256': hashlib.sha256(data).hexdigest(),
                'capturedAt': datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z'),
                'sourceFile': file.name,
            }) + '\n')
            seen.add(file.name)
        except (OSError, ValueError, struct.error):
            continue
    time.sleep(0.1)
if not (output / 'capture.json').exists():
    raise SystemExit('No fresh native Skia export captured; rerun this flow')

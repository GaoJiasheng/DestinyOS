"""Wait for native samples and film effects without recording during the compute benchmark."""
import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
import signal
import subprocess
import sys
import time

names = {'starfield', 'sphere', 'particles', 'tarot', 'coins', 'wheel'}
recording = None
movie = Path(sys.argv[3])
log = Path(sys.argv[4])

def container():
    return Path(subprocess.check_output([
        'xcrun', 'simctl', 'get_app_container', sys.argv[1], 'pub.gavin.tianji', 'data',
    ], text=True).strip())

def stop_recording():
    global recording
    if recording is None:
        return
    if recording.poll() is None:
        recording.send_signal(signal.SIGINT)
    recording.wait(timeout=20)
    recording = None

# DESIGN-GAP: Loopback polling keeps XCTest queries outside frame windows; capture starts
# only after uncached compute validation, and the app restarts for fresh filmed samples.
class WaitHandler(BaseHTTPRequestHandler):
    def reply(self, value):
        payload = json.dumps(value).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        global recording
        if self.path == '/recording/start':
            if recording is not None:
                self.send_error(409, 'Recording already started')
                return
            with log.open('w') as output:
                recording = subprocess.Popen([
                    'xcrun', 'simctl', 'io', sys.argv[1], 'recordVideo',
                    '--force', '--codec=h264', str(movie),
                ], stdout=output, stderr=output)
            deadline = time.monotonic() + 10
            while time.monotonic() < deadline:
                if 'Recording started' in log.read_text():
                    for name in names:
                        (container() / 'Documents' / f'M02-{name}.json').unlink(missing_ok=True)
                    self.reply({'started': True})
                    return
                if recording.poll() is not None:
                    self.send_error(503, log.read_text())
                    return
                time.sleep(.05)
            self.send_error(408, 'Recorder did not start')
            return
        if self.path == '/recording/stop':
            try:
                stop_recording()
                if not movie.is_file() or movie.stat().st_size == 0:
                    raise RuntimeError('No finalized video')
                self.reply({'stopped': True})
            except (OSError, RuntimeError, subprocess.TimeoutExpired) as error:
                self.send_error(500, str(error))
            return
        name = self.path.removeprefix('/frames/')
        if name not in names:
            self.send_error(404)
            return
        target = container() / 'Documents' / f'M02-{name}.json'
        deadline = time.monotonic() + 40
        while time.monotonic() < deadline:
            if target.exists():
                try:
                    value = json.loads(target.read_text())
                except (OSError, json.JSONDecodeError):
                    time.sleep(.05)
                    continue
                self.reply(value)
                return
            time.sleep(.05)
        self.send_error(408, 'Native frame sample did not finish')

    def log_message(self, *_args):
        pass

def terminate(*_args):
    raise SystemExit(130)

signal.signal(signal.SIGTERM, terminate)
server = HTTPServer(('127.0.0.1', 0), WaitHandler)
Path(sys.argv[2]).write_text(str(server.server_port))
try:
    server.serve_forever()
finally:
    stop_recording()
    server.server_close()

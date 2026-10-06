"""Wait for simulator frame JSON without intrusive XCTest hierarchy queries during sampling."""
import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
import subprocess
import sys
import time

# DESIGN-GAP: Loopback host polling keeps XCTest accessibility queries outside the measured window.
class WaitHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        name = self.path.removeprefix('/frames/')
        if name not in {'starfield', 'sphere', 'particles', 'tarot', 'coins', 'wheel'}:
            self.send_error(404)
            return
        container = subprocess.check_output([
            'xcrun', 'simctl', 'get_app_container', sys.argv[1], 'pub.gavin.tianji', 'data',
        ], text=True).strip()
        target = Path(container) / 'Documents' / f'M02-{name}.json'
        deadline = time.monotonic() + 40
        while time.monotonic() < deadline:
            if target.exists():
                try:
                    value = json.loads(target.read_text())
                    payload = json.dumps(value).encode()
                except (OSError, json.JSONDecodeError):
                    time.sleep(.05)
                    continue
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(payload)
                return
            time.sleep(.05)
        self.send_error(408, 'Native frame sample did not finish')

    def log_message(self, *_args):
        pass

server = HTTPServer(('127.0.0.1', 0), WaitHandler)
Path(sys.argv[2]).write_text(str(server.server_port))
server.serve_forever()

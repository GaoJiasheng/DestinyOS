#!/usr/bin/env python3
"""Inspect a stopped, local smoke D1 snapshot without exposing tokens or birth fields."""
import datetime
import hashlib
import json
import pathlib
import shutil
import sqlite3
import sys
import tempfile

phase, output, handle = sys.argv[1:4]
repo = pathlib.Path(__file__).resolve().parents[3]
root = repo / 'apps/web/.wrangler/state/v3/d1'
databases = [p for p in root.rglob('*.sqlite') if p.name != 'metadata.sqlite']
if len(databases) != 1:
    raise RuntimeError('Expected the dedicated local smoke D1 database; stop pnpm cf:smoke first')
# DESIGN-GAP: Read only a temporary snapshot after Worker shutdown; never inspect production D1 or print private columns.
with tempfile.TemporaryDirectory(prefix='tianji-ios-proof-') as directory:
    snapshot = pathlib.Path(directory) / 'snapshot.sqlite'
    shutil.copyfile(databases[0], snapshot)
    db = sqlite3.connect(snapshot)
    db.row_factory = sqlite3.Row
    private_handle = pathlib.Path(handle)
    if phase == 'before':
        row = db.execute("SELECT id FROM User WHERE email LIKE 'ios-build-%@example.test' AND deletedAt IS NULL ORDER BY createdAt DESC LIMIT 1").fetchone()
        if not row:
            raise RuntimeError('No real magic-link account from the dedicated smoke entry')
        user = row['id']
        private_handle.touch(mode=0o600, exist_ok=False)
        private_handle.write_text(user)
    elif phase == 'after':
        user = private_handle.read_text()
    else:
        raise ValueError('Use before or after')
    profiles = db.execute('SELECT encBirth, encPlace, encName FROM BirthProfile WHERE userId=?', (user,)).fetchall()
    readings = db.execute('SELECT system, status, encInput, isPublic FROM Reading WHERE userId=?', (user,)).fetchall()
    sessions = db.execute('SELECT count(*) FROM MobileSession WHERE userId=?', (user,)).fetchone()[0]
    deleted = db.execute('SELECT deletedAt FROM User WHERE id=?', (user,)).fetchone()
    shares = db.execute('SELECT count(*) FROM ShareLink WHERE userId=? AND revokedAt IS NULL', (user,)).fetchone()[0]
    encrypted = all(value is None or value.startswith('v1:') for row in profiles for value in row) and all(row['encInput'].startswith('v1:') for row in readings)
    passed = (len(profiles) > 0 and len(readings) > 0 and encrypted and sessions > 0) if phase == 'before' else (deleted is not None and deleted['deletedAt'] is not None and sessions == 0 and shares == 0 and all(not row['isPublic'] for row in readings))
    # Document the required seven-day soft-delete retention, rather than falsely asserting immediate physical erasure.
    result = {'phase': phase, 'platform': 'real-local-multi-worker-D1', 'actorSha256': hashlib.sha256(user.encode()).hexdigest(),
              'profiles': len(profiles), 'readings': len(readings), 'systems': sorted({row['system'] for row in readings}),
              'encryptedPrivateFields': encrypted, 'mobileSessions': sessions, 'activeShareLinks': shares,
              'softDeleted': deleted is not None and deleted['deletedAt'] is not None,
              'retentionDaysAfterDeletion': 7, 'passed': passed,
              'checkedAt': datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z')}
    destination = pathlib.Path(output)
    destination.mkdir(parents=True, exist_ok=True)
    (destination / f'backend-{phase}.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2))
    if phase == 'after':
        private_handle.unlink()
    if not passed:
        raise SystemExit(1)

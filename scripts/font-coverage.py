#!/usr/bin/env python3
"""Check real WOFF2 cmaps and declared shard characters against Taiwan UI/report/tutorial text."""
import json
from pathlib import Path
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'apps/web/public/fonts'
required = set((ROOT / 'scripts/resources/screen-tw.txt').read_text())
required.update(''.join(json.loads((ROOT / 'apps/web/messages/zh-TW.json').read_text()).values()))
for path in (ROOT / 'apps/web/messages/zh-TW').glob('*.json'):
    required.update(''.join(json.loads(path.read_text()).values()))
required = {ord(c) for c in required if '\u3000' <= c <= '\u9fff'}
inventory = json.loads((OUT / 'selection.json').read_text())
for family in ('wenkai', 'noto'):
    covered = set(TTFont(OUT / (family + '-ui.woff2')).getBestCmap())
    for shard in inventory['fonts']:
        if shard['family'] != family:
            continue
        codes = set(TTFont(OUT / shard['file']).getBestCmap())
        declared = {ord(c) for c in shard['chars']}
        if declared - codes:
            raise ValueError(f"{shard['file']}: advertised glyphs absent from WOFF2")
        covered.update(codes)
    missing = required - covered
    if missing:
        raise ValueError(f'{family}: missing {len(missing)} traditional glyphs: ' + ''.join(chr(c) for c in sorted(missing)))
    print(f'{family}: {len(required)} Taiwan UI/report/tutorial glyphs covered in WOFF2')

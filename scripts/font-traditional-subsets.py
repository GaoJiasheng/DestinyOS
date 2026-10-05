#!/usr/bin/env python3
"""Supplement existing screen shards with Taiwan common, UI and metaphysical glyphs (OFL sources)."""
import hashlib
import json
import subprocess
import urllib.request
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'apps/web/public/fonts'
CACHE = Path('/tmp/destiny-font-sources')
CACHE.mkdir(parents=True, exist_ok=True)
SOURCES = {
    'wenkai': ('https://raw.githubusercontent.com/lxgw/LxgwWenKai/main/fonts/TTF/LXGWWenKai-Regular.ttf', '39ad71264b588165b469e35e6afb162a378dacd1f95348160240ba9038ac3009'),
    'noto': ('https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf', '050080d9255a86808f2945bffac582b31ef32bc36411ce29563b4961670c66f9'),
}
required = set((ROOT / 'scripts/resources/common-3500-tw.txt').read_text(encoding='utf-8-sig'))
required.update((ROOT / 'scripts/resources/screen-tw.txt').read_text())
required.update(''.join(json.loads((ROOT / 'apps/web/messages/zh-TW.json').read_text()).values()))
for path in (ROOT / 'apps/web/messages/zh-TW').glob('*.json'):
    for key, value in json.loads(path.read_text()).items():
        if key.endswith('.term'):
            required.update(value)
required = {ord(c) for c in required if '\u3000' <= c <= '\u9fff'}
inventory = json.loads((OUT / 'selection.json').read_text())
budget = json.loads((OUT / 'budget.json').read_text())
# DESIGN-GAP: Append missing glyphs without renumbering shipped shards, preserving immutable URLs and screenshot typography; the 350KB page cap continues to apply.
for family, (url, sha) in SOURCES.items():
    source = CACHE / (family + '.ttf')
    if not source.exists():
        with urllib.request.urlopen(url, timeout=60) as response:
            source.write_bytes(response.read())
    if hashlib.sha256(source.read_bytes()).hexdigest() != sha:
        raise ValueError('Review source hash before changing the pinned font')
    base = TTFont(source)
    base.recalcTimestamp = False
    if 'fvar' in base:
        base = instantiateVariableFont(base, {'wght': 400}, inplace=True)
    supported = set(base.getBestCmap())
    if required - supported:
        raise ValueError(f'{family}: required traditional glyphs missing: ' + ''.join(chr(c) for c in sorted(required-supported)))
    existing = set()
    for f in inventory['fonts']:
        if f['family'] == family:
            existing.update(ord(c) for c in f['chars'])
    existing.update(TTFont(OUT / (family + '-ui.woff2')).getBestCmap())
    missing = sorted(required - existing)
    next_index = max([8999] + [int(f['file'].split('-body-')[1].split('.')[0]) for f in inventory['fonts'] if f['family'] == family]) + 1
    static = CACHE / (family + '-traditional-static.ttf')
    base.save(static)
    for offset in range(0, len(missing), 8):
        codes = missing[offset:offset + 8]
        font = TTFont(static)
        font.recalcTimestamp = False
        options = subset.Options()
        options.hinting = False
        options.layout_features = []
        options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]
        worker = subset.Subsetter(options=options)
        worker.populate(unicodes=codes)
        worker.subset(font)
        name = family + '-body-%04d.woff2' % (next_index + offset // 8)
        for record in font['name'].names:
            if record.nameID in (1,3,4,6):
                record.string = ('Tianji-' + family + '-TW-' + str(offset)).encode(record.getEncoding())
        font.flavor = 'woff2'
        font.save(OUT / name)
        size = (OUT / name).stat().st_size
        inventory['fonts'].append({'file':name, 'bytes':size, 'chars':''.join(chr(c) for c in codes), 'family':family})
        budget['files'][name] = {'bytes':size, 'sha256':hashlib.sha256((OUT/name).read_bytes()).hexdigest()}
    print(f'{family}: {len(missing)} additional Taiwan glyphs')
(OUT / 'selection.json').write_text(json.dumps(inventory, ensure_ascii=False, indent=2) + '\n')
(OUT / 'budget.json').write_text(json.dumps(budget, ensure_ascii=False, indent=2) + '\n')
subprocess.run(['pnpm', 'exec', 'prettier', '--write', str(OUT / 'selection.json'), str(OUT / 'budget.json')], cwd=ROOT, check=True)

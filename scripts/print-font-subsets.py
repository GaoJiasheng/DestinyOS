#!/usr/bin/env python3
"""Supplement the print edition's self-hosted Noto Serif SC subsets from the complete bilingual corpus."""
import hashlib
import json
import re
import sys
import urllib.request
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parents[1]
CACHE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('/tmp/destiny-assets')
OUT = ROOT / 'apps/web/public/fonts'
SOURCE = 'https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf'
SHA = '050080d9255a86808f2945bffac582b31ef32bc36411ce29563b4961670c66f9'
CACHE.mkdir(parents=True, exist_ok=True)
source = CACHE / 'noto.ttf'
if not source.exists():
    with urllib.request.urlopen(SOURCE, timeout=180) as response:
        source.write_bytes(response.read())
if hashlib.sha256(source.read_bytes()).hexdigest() != SHA:
    raise ValueError('Review changed Noto font source before updating the pinned hash')
base = TTFont(source)
base = instantiateVariableFont(base, {'wght': 400}, inplace=True)
base.recalcTimestamp = False
supported = set(base.getBestCmap())
static = CACHE / 'noto-print-static.ttf'
base.save(static)
existing = set()
for file in ['fonts.css', 'fonts-body.css']:
    for face in (OUT / file).read_text().split('@font-face'):
        if "'Noto Serif SC'" in face:
            existing.update(int(code, 16) for code in re.findall(r'U\+([0-9A-F]+)', face))
corpus = ''.join(file.read_text() for file in (ROOT / 'packages/content/dist').glob('*.json'))
corpus += ''.join(file.read_text() for file in (ROOT / 'apps/web/messages').rglob('*.json'))
# DESIGN-GAP: Existing screen fonts intentionally fall back for rare prose; print supplements every supported corpus glyph plus Latin/punctuation in bounded 600-glyph shards.
required = sorted({ord(char) for char in corpus if ord(char) in supported} - existing)
css = []
manifest = {'source': SOURCE, 'sha256': SHA, 'license': 'OFL-1.1', 'glyphs': len(required), 'files': []}
for offset in range(0, len(required), 600):
    codes = required[offset:offset + 600]
    font = TTFont(static)
    font.recalcTimestamp = False
    options = subset.Options()
    options.flavor = 'woff2'
    options.hinting = False
    options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]
    worker = subset.Subsetter(options=options)
    worker.populate(unicodes=codes)
    worker.subset(font)
    name = 'noto-print-%02d' % (offset // 600)
    for record in font['name'].names:
        if record.nameID in (1, 3, 4, 6):
            record.string = ('Tianji-' + name).encode(record.getEncoding())
    font.flavor = 'woff2'
    file = OUT / (name + '.woff2')
    font.save(file)
    if file.stat().st_size > 300 * 1024:
        raise ValueError('Print font shard exceeds 300KB')
    ranges = ','.join('U+%X' % code for code in codes)
    css.append("@font-face{font-family:'Noto Serif SC';font-style:normal;font-weight:400;font-display:block;src:url('/fonts/%s.woff2') format('woff2');unicode-range:%s;}" % (name, ranges))
    manifest['files'].append({'file': file.name, 'bytes': file.stat().st_size})
(OUT / 'fonts-print.css').write_text('\n'.join(css) + '\n')
(OUT / 'print-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps(manifest['files']))

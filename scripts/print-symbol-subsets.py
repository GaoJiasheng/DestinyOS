#!/usr/bin/env python3
"""Self-host the complete zodiac/planet glyph set used by print SVG charts (OFL)."""
import hashlib
import json
import sys
import urllib.request
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parents[1]
CACHE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('/tmp/destiny-assets')
OUT = ROOT / 'apps/web/public/fonts'
CACHE.mkdir(parents=True, exist_ok=True)
SOURCES = [
    ('symbols', 'NotoSansSymbols%5Bwght%5D.ttf', 'f7e7e04b4a24b6c78893d50cbfd2b2f6cae49617ab047bfef668d252adb128f7', '♈♉♊♋♌♍♎♏♐♑♒♓☽☿♀♂♃♄♅♆♇☊⚷⚸'),
    ('symbols2', 'NotoSansSymbols2-Regular.ttf', '7d5fb73b7ca67a6798101741f5d280a3d016a56a197afcd4199dbb57b4b82a21', '☉'),
]
css = []
manifest = []
# DESIGN-GAP: SVG astrology glyphs need a dedicated OFL subset; serverless hosts have no reliable system symbol font.
for name, filename, digest, glyphs in SOURCES:
    url = 'https://raw.githubusercontent.com/google/fonts/main/ofl/notosans%s/%s' % (name, filename)
    source = CACHE / ('print-' + name + '.ttf')
    if not source.exists():
        with urllib.request.urlopen(url, timeout=90) as response:
            source.write_bytes(response.read())
    if hashlib.sha256(source.read_bytes()).hexdigest() != digest:
        raise ValueError('Review changed symbol font source before updating pinned hash')
    font = TTFont(source)
    if 'fvar' in font:
        font = instantiateVariableFont(font, {'wght': 400}, inplace=True)
    font.recalcTimestamp = False
    codes = sorted({ord(char) for char in glyphs})
    if not set(codes).issubset(font.getBestCmap()):
        raise ValueError('Missing chart symbol glyph')
    options = subset.Options()
    options.flavor = 'woff2'
    options.hinting = False
    options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]
    worker = subset.Subsetter(options=options)
    worker.populate(unicodes=codes)
    worker.subset(font)
    derivative = 'Tianji-Print-' + name
    for record in font['name'].names:
        if record.nameID in (1, 3, 4, 6):
            record.string = derivative.encode(record.getEncoding())
    font.flavor = 'woff2'
    target = OUT / ('print-' + name + '.woff2')
    font.save(target)
    ranges = ','.join('U+%X' % code for code in codes)
    css.append("@font-face{font-family:'Tianji Print Symbols';font-style:normal;font-weight:400;font-display:block;src:url('/fonts/%s') format('woff2');unicode-range:%s;}" % (target.name, ranges))
    license_url = url.rsplit('/', 1)[0] + '/OFL.txt'
    with urllib.request.urlopen(license_url, timeout=90) as response:
        (OUT / ('OFL-Print-' + name + '.txt')).write_text('\n'.join(line.rstrip() for line in response.read().decode().splitlines()) + '\n')
    manifest.append({'source': url, 'sha256': digest, 'license': 'OFL-1.1', 'file': target.name, 'bytes': target.stat().st_size})
(OUT / 'fonts-print-symbols.css').write_text('\n'.join(css) + '\n')
(OUT / 'print-symbol-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps(manifest))

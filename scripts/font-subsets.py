#!/usr/bin/env python3
"""Rebuild self-hosted OFL fonts: python3 scripts/font-subsets.py [source-cache]. Requires fonttools[woff] (MIT)."""
import hashlib
from collections import Counter
import json
import subprocess
import sys
import urllib.request
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parents[1]
CACHE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('/tmp/destiny-font-sources')
OUT = ROOT / 'apps/web/public/fonts'
CACHE.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)
for obsolete in OUT.glob('*-body-*.woff2'):
    obsolete.unlink()
SOURCES = {
    'wenkai': 'https://raw.githubusercontent.com/lxgw/LxgwWenKai/main/fonts/TTF/LXGWWenKai-Regular.ttf',
    'noto': 'https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf',
}
EXPECTED_SHA256 = {
    'wenkai': '39ad71264b588165b469e35e6afb162a378dacd1f95348160240ba9038ac3009',
    'noto': '050080d9255a86808f2945bffac582b31ef32bc36411ce29563b4961670c66f9',
}
messages = json.loads((ROOT / 'apps/web/messages/zh.json').read_text())
common = set((ROOT / 'scripts/resources/common-3500.txt').read_text(encoding='utf-8-sig'))
terms = set()
for file in (ROOT / 'apps/web/messages/zh').glob('*.json'):
    for key, value in json.loads(file.read_text()).items():
        if key.endswith('.term'):
            terms.update(value)
# DESIGN-GAP: UI and all glossary terms supplement the standard common-3500 list; rare prose glyphs use system serif fallback.
ui = set(''.join(messages.values()))
characters = {c for c in common | terms | ui if '\u3000' <= c <= '\u9fff'}
first = set('天机DestinyOS')
for key, value in messages.items():
    if key.startswith(('home.', 'nav.', 'legal.', 'disclaimer.', 'brand.', 'common.', 'pwa.', 'daily.oneliner.', 'daily.color.')) or key == 'report.disclaimer.short':
        first.update(value)
first = {c for c in first if '\u3000' <= c <= '\u9fff'}
report = {'characters': len(characters), 'firstScreenCharacters': len(first), 'files': {}, 'sources': {}}
css = []
body_css = []
inventory = {"initial": {}, "fonts": []}
for family, url in SOURCES.items():
    file = CACHE / (family + '.ttf')
    if not file.exists():
        with urllib.request.urlopen(url, timeout=180) as response:
            file.write_bytes(response.read())
    if hashlib.sha256(file.read_bytes()).hexdigest() != EXPECTED_SHA256[family]:
        raise ValueError(family + ' source changed; review and explicitly update the pinned source hash')
    report['sources'][family] = {'url': url, 'sha256': hashlib.sha256(file.read_bytes()).hexdigest(), 'license': 'SIL-OFL-1.1'}
    # DESIGN-GAP: Eight-character deferred shards avoid fetching unused glyphs under the single-page font budgets.
    first_chars = first
    if family == 'wenkai':
        # Only headings use WenKai; body/UI copy belongs to Noto Serif SC.
        first_chars = set('天机甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥')
        for key, value in messages.items():
            if key.startswith('nav.') or (key.startswith('home.') and key.endswith('.title')):
                first_chars.update(value)
        first_chars = {c for c in first_chars if '\u3000' <= c <= '\u9fff'}
    frequencies = Counter(''.join(messages.values()))
    for corpus in (ROOT / 'packages/content/dist').glob('*.zh.json'):
        frequencies.update(corpus.read_text())
    remaining = sorted(characters - first_chars, key=lambda c: (-frequencies[c], c))
    segments = [('ui', first_chars)] + [('body-%03d' % (i // 8), set(remaining[i:i+8])) for i in range(0, len(remaining), 8)]
    base = TTFont(file)
    base.recalcTimestamp = False
    if 'fvar' in base:
        base = instantiateVariableFont(base, {'wght': 400}, inplace=True)
    static_file = CACHE / (family + '-static.ttf')
    base.save(static_file)
    for segment, chars in segments:
        font = TTFont(static_file)
        font.recalcTimestamp = False
        if 'fvar' in font:
            # DESIGN-GAP: A static 400 instance plus browser-synthesized 600 keeps combined Chinese page fonts within 350KB.
            font = instantiateVariableFont(font, {'wght': 400}, inplace=True)
        options = subset.Options()
        options.flavor = 'woff2'
        options.hinting = False
        options.desubroutinize = True
        options.layout_features = []
        options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]
        worker = subset.Subsetter(options=options)
        worker.populate(unicodes=[ord(c) for c in chars])
        worker.subset(font)
        # Retain copyright/license but rename derivatives to honor reserved font names.
        for record in font['name'].names:
            if record.nameID in (1, 3, 4, 6):
                label = 'Tianji-' + family.title() + '-' + segment if record.nameID == 6 else 'Tianji ' + family.title() + ' ' + segment
                record.string = label.encode(record.getEncoding())
        font.flavor = 'woff2'
        name = family + '-' + segment + '.woff2'
        font.save(OUT / name)
        size = (OUT / name).stat().st_size
        if segment == 'ui':
            inventory['initial'][family] = size
        else:
            inventory['fonts'].append({'file': name, 'bytes': size, 'chars': ''.join(sorted(chars)), 'family': family})
        report['files'][name] = {'bytes': size, 'sha256': hashlib.sha256((OUT / name).read_bytes()).hexdigest()}
        ranges = ','.join('U+%X' % ord(c) for c in sorted(chars))
        label = 'LXGW WenKai' if family == 'wenkai' else 'Noto Serif SC'
        (css if segment == 'ui' else body_css).append("@font-face{font-family:'%s';font-style:normal;font-weight:400;font-display:swap;src:url('/fonts/%s') format('woff2');unicode-range:%s;}" % (label, name, ranges))
    limit = (180 if family == 'wenkai' else 300) * 1024
    if any(v['bytes'] > limit for k, v in report['files'].items() if k.startswith(family)):
        raise ValueError(family + ' font shard exceeds budget')
(OUT / 'selection.json').write_text(json.dumps(inventory, ensure_ascii=False, indent=2) + '\n')
(OUT / 'fonts.css').write_text('\n'.join(css) + '\n')
(OUT / 'fonts-body.css').write_text('\n'.join(body_css) + '\n')
(ROOT / 'apps/web/app/[locale]/fonts.css').write_text('\n'.join(css) + '\n')
(OUT / 'budget.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'characters':len(characters), 'files':len(report['files']), 'initialBytes':sum(v['bytes'] for k,v in report['files'].items() if '-ui.' in k)}, ensure_ascii=False))

subprocess.run(["pnpm", "exec", "prettier", "--write", str(OUT / "fonts.css"), str(OUT / "fonts-body.css"), str(OUT / "budget.json"), str(OUT / "selection.json"), str(ROOT / "apps/web/app/[locale]/fonts.css")], cwd=ROOT, check=True)

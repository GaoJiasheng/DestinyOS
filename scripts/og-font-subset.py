"""Build the embedded OG TrueType subset from the pinned SIL-OFL Noto source."""
from pathlib import Path
import hashlib
import json
import urllib.request
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path('/tmp/destiny-og-noto.ttf')
URL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf'
SHA256 = '050080d9255a86808f2945bffac582b31ef32bc36411ce29563b4961670c66f9'
if not SOURCE.exists():
    with urllib.request.urlopen(URL, timeout=60) as response:
        SOURCE.write_bytes(response.read())
if hashlib.sha256(SOURCE.read_bytes()).hexdigest() != SHA256:
    raise ValueError('Font source changed; review the source before changing the pinned hash')
characters = set((ROOT / 'scripts/resources/common-3500.txt').read_text(encoding='utf-8-sig'))
characters.update(''.join(json.loads((ROOT / 'apps/web/messages/zh.json').read_text()).values()))
characters.update((ROOT / 'scripts/resources/common-3500-tw.txt').read_text(encoding='utf-8-sig'))
for catalog in (ROOT / 'apps/web/messages/zh-TW').glob('*.json'):
    characters.update(''.join(json.loads(catalog.read_text()).values()))
characters.update(''.join(json.loads((ROOT / 'apps/web/messages/zh-TW.json').read_text()).values()))
characters.update(chr(i) for i in range(32, 127))
characters.update('★☆·–—‘’“”')
# DESIGN-GAP: Public headline glyphs supplement the common-3500 set; images never include full report bodies.
for source in (ROOT / 'packages/content').glob('*/*.yaml'):
    characters.update(source.read_text())
font = TTFont(SOURCE)
font.recalcTimestamp = False
font = instantiateVariableFont(font, {'wght': 400}, inplace=True)
options = subset.Options()
options.recalc_timestamp = False
subsetter = subset.Subsetter(options=options)
subsetter.populate(text=''.join(sorted(characters)))
subsetter.subset(font)
font.flavor = None
font.save(ROOT / 'apps/web/resources/og-font.ttf')
print('Embedded OFL TrueType subset built.')

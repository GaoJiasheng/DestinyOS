"""Embed native-compatible subsets of the same OFL font sources as Web (fonttools[woff])."""
import hashlib
import json
import subprocess
from pathlib import Path
import urllib.request
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'apps/mobile/assets/fonts'
keys = ['brand.nameZh', 'brand.nameEn', 'brand.tagline', 'home.eyebrow', 'home.cta.today',
        'report.disclaimer.short', 'common.comingSoon.title']
brand = json.loads(subprocess.check_output([
    'pnpm', 'exec', 'tsx', '-e',
    "import { brand } from './packages/shared/src/brand.ts'; process.stdout.write(JSON.stringify(brand));",
], cwd=ROOT, text=True))
chars = set(''.join(brand[key] for key in ['nameZh', 'nameZhTW', 'nameEn']) +
            ''.join(chr(i) for i in range(32, 127)))
for locale in ['zh', 'zh-TW', 'en']:
    messages = json.loads((ROOT / f'apps/web/messages/{locale}.json').read_text())
    for key, value in messages.items():
        if key in keys or key.startswith(('nav.', 'mobile.effects.', 'charts.planet.')):
            chars.update(value)
# DESIGN-GAP: Native requires TTF/OTF rather than Web's WOFF2; the native subset covers the shell and effect labels in all three locales.
# Match the pinned Web source hashes; fetch only when the shared local cache is absent.
cache = Path('/tmp/destiny-font-sources')
cache.mkdir(parents=True, exist_ok=True)
for family, url, expected in [
    ('wenkai', 'https://raw.githubusercontent.com/lxgw/LxgwWenKai/main/fonts/TTF/LXGWWenKai-Regular.ttf', '39ad71264b588165b469e35e6afb162a378dacd1f95348160240ba9038ac3009'),
    ('noto', 'https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf', '050080d9255a86808f2945bffac582b31ef32bc36411ce29563b4961670c66f9'),
]:
    target = cache / f'{family}.ttf'
    if not target.exists():
        with urllib.request.urlopen(url, timeout=180) as response:
            target.write_bytes(response.read())
    if hashlib.sha256(target.read_bytes()).hexdigest() != expected:
        raise ValueError(f'{family} source changed; review against Web before rebuilding')
sources = {
    'wenkai': Path('/tmp/destiny-font-sources/wenkai.ttf'),
    'noto': Path('/tmp/destiny-font-sources/noto.ttf'),
    'cinzel': ROOT / 'apps/web/node_modules/@fontsource/cinzel/files/cinzel-latin-600-normal.woff2',
    'cormorant': ROOT / 'apps/web/node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-600-normal.woff2',
    'inter': ROOT / 'apps/web/node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2',
}
OUT.mkdir(parents=True, exist_ok=True)
manifest = {}
for family, source in sources.items():
    font = TTFont(source)
    font.recalcTimestamp = False
    if 'fvar' in font:
        font = instantiateVariableFont(font, {'wght': 400}, inplace=True)
    options = subset.Options()
    options.hinting = False
    options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]
    worker = subset.Subsetter(options=options)
    worker.populate(unicodes=[ord(char) for char in chars])
    worker.subset(font)
    font.flavor = None
    for record in font['name'].names:
        if record.nameID in (1, 3, 4, 6):
            record.string = f'TianjiMobile-{family}'.encode(record.getEncoding())
    target = OUT / f'{family}.ttf'
    font.save(target)
    manifest[family] = {'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                        'bytes': target.stat().st_size, 'license': 'OFL-1.1'}
    if family in ['wenkai', 'noto']:
        missing = chars - set(chr(code) for code in font.getBestCmap())
        if missing:
            raise ValueError(f'{family} missing glyphs: {missing}')
(OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')

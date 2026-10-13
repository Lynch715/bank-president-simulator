"""Build transparent WebP portraits and embed them in both single-file entrypoints."""
import base64
import json
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / 'assets' / 'portraits'
spec = json.loads((ART / 'prompts.json').read_text())
portraits = {}
manifest = []
for person in spec['characters']:
    key = person['id']
    source = ART / 'source' / f'{key}.png'
    if not source.exists():
        raise FileNotFoundError(f'Missing character portrait: {source}')
    with Image.open(source) as im:
        assert im.mode == 'RGBA', (key, im.mode)
        assert im.getchannel('A').getextrema()[0] == 0, f'{key}: missing transparency'
        web = ImageOps.contain(im, (420, 560), Image.Resampling.LANCZOS)
        target = ART / 'web' / f'{key}.webp'
        web.save(target, 'WEBP', quality=84, method=6)
        portraits[key] = 'data:image/webp;base64,' + base64.b64encode(target.read_bytes()).decode()
        manifest.append({'id': key, 'name': person['name'], 'source': f'source/{key}.png',
                         'web': f'web/{key}.webp', 'size': list(web.size), 'bytes': target.stat().st_size})

html = (ROOT / 'index.html').read_text()
start = html.index('/* PORTRAIT_DATA_START */')
end = html.index('/* PORTRAIT_DATA_END */', start) + len('/* PORTRAIT_DATA_END */')
data = '/* PORTRAIT_DATA_START */\nconst PORTRAITS = ' + json.dumps(portraits, separators=(',', ':')) + ';\n/* PORTRAIT_DATA_END */'
html = html[:start] + data + html[end:]
(ROOT / 'index.html').write_text(html)
(ROOT / '模拟银行.html').write_text(html)
(ART / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2))

columns = 6
rows = (len(manifest) + columns - 1) // columns
board = Image.new('RGB', (columns * 210, rows * 300), '#f2eee5')
draw = ImageDraw.Draw(board)
for i, item in enumerate(manifest):
    with Image.open(ART / item['web']) as im:
        thumb = ImageOps.contain(im, (194, 258), Image.Resampling.LANCZOS)
        x, y = (i % columns) * 210, (i // columns) * 300
        board.paste(thumb, (x + (210 - thumb.width) // 2, y + 4), thumb)
        draw.text((x + 12, y + 270), item['id'], fill='#253e52')
board.save(ART / 'overview.jpg', quality=90)
print(f'Built {len(portraits)}/{len(spec["characters"])} portraits, {sum(m["bytes"] for m in manifest):,} WebP bytes; entrypoints synchronized.')

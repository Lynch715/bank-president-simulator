"""Embed the ending-only renderer and its images; keep both offline HTML files identical."""
import base64
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parents[1]
html_path = root / 'index.html'
html = html_path.read_text()
code = (root / 'scripts/settlement-poster.js').read_text().strip()
code_tag = '<script id="bankSettlementCode">\n' + code + '\n</script>'
if '<script id="bankSettlementCode">' in html:
    html = re.sub(r'<script id="bankSettlementCode">[\s\S]*?</script>', lambda _: code_tag, html, count=1)
else:
    html = html.replace('<script id="bankGameCode">', code_tag + '\n<script id="bankGameCode">', 1)
data = {}
for key, name, mime in [('background', 'background.jpg', 'image/jpeg'), ('qr', 'game-qr.png', 'image/png')]:
    data[key] = 'data:' + mime + ';base64,' + base64.b64encode((root / 'assets/settlement' / name).read_bytes()).decode()
data_tag = '<script type="application/json" id="bankSettlementData">' + json.dumps(data, separators=(',', ':')) + '</script>'
if '<script type="application/json" id="bankSettlementData">' in html:
    html = re.sub(r'<script type="application/json" id="bankSettlementData">[\s\S]*?</script>', lambda _: data_tag, html, count=1)
else:
    html = html.replace('</body>', data_tag + '\n</body>', 1)
html_path.write_text(html)
(root / '模拟银行.html').write_bytes(html_path.read_bytes())
print('Embedded settlement renderer and two images; both standalone entrypoints synchronized.')

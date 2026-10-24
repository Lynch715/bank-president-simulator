"""Keep the two standalone HTML entrypoints and authored styles in sync."""
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
source = root / 'index.html'
html = source.read_text()
for style_id, name in [('paperLedgerTheme', 'paper-ledger.css'), ('bankAppearanceTheme', 'grand-banking.css')]:
    pattern = r'(<style id="' + style_id + r'">)[\s\S]*?(</style>)'
    css = (root / 'styles' / name).read_text().strip()
    html, count = re.subn(pattern, lambda m: m[1] + '\n' + css + '\n' + m[2], html, count=1)
    if count != 1:
        raise SystemExit('Missing style block: ' + style_id)
source.write_text(html)
(root / '模拟银行.html').write_bytes(source.read_bytes())
print('Synced two inline styles and both standalone entrypoints.')

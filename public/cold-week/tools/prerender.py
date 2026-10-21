# -----------------------------------------------------------------------------
# يصنع صور الطبقة C (بلا 3D) من الطبقة A نفسها، ويحفظ مواضع رؤوس الدمى فيها.
#   python3 tools/prerender.py http://localhost:8765
# يحتاج: pip install playwright pillow && playwright install chromium
# الناتج: assets/c-single.webp و assets/c-race.webp و assets/c-meta.json
#         و assets/cards/<id>.webp (صور مجسّمات البطاقات ثلاثية الأبعاد: للطبقة C وللعنصر تحت اليد)
# التصيير بمحرّك WebGL2 بإعدادات الطبقة A (?tier=A&webgl) لأن WebGPU لا يعمل دائمًا بلا شاشة.
# -----------------------------------------------------------------------------
import json
import sys
import time
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765'
OUT = Path(__file__).resolve().parent.parent / 'assets'
OUT.mkdir(exist_ok=True)
W, H = 2600, 1000  # الارتفاع 1000 بكسل = 1000u، فالمواضع بالبكسل هي نفسها بوحدة المسرح

meta = {}
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    for mode in ('single', 'race'):
        pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=1)
        pg.goto(f'{BASE}/cold-week/index.html?render={mode}&tier=A&webgl&test')
        pg.wait_for_selector('.cw-loader.done', state='attached', timeout=600000)
        time.sleep(8)  # إطارات كافية لاستقرار الظلال والتوهّج والغبار الضوئي
        m = pg.evaluate('window.__board.game.scene.exportMeta()')
        png = OUT / f'c-{mode}.png'
        pg.screenshot(path=str(png), timeout=600000, animations='disabled')
        im = Image.open(png).convert('RGB')
        im.save(OUT / f'c-{mode}.webp', 'WEBP', quality=80, method=6)
        png.unlink()
        meta[mode] = {'img': f'assets/c-{mode}.webp', 'w': m['w'], 'h': m['h'], 'box': m['box'], 'rooms': m['rooms']}
        print(mode, (OUT / f'c-{mode}.webp').stat().st_size // 1024, 'KB')
        pg.close()
    # مجسّمات البطاقات: شبكة ١٠×٢ خلايا (٢٠٠u) على خلفية بيضاء، وتُقصّ كل خلية صورةً
    CARDS = OUT / 'cards'
    CARDS.mkdir(exist_ok=True)
    pg = b.new_page(viewport={'width': 2000, 'height': 1000}, device_scale_factor=1.5)
    pg.goto(f'{BASE}/cold-week/index.html?render=cards&tier=A&webgl&test')
    pg.wait_for_selector('.cw-loader.done', state='attached', timeout=600000)
    time.sleep(6)
    ids = pg.evaluate('window.__board.game.scene.ui.galleryIds')
    full = OUT / 'cards-all.png'
    pg.screenshot(path=str(full), timeout=600000, animations='disabled')
    sheet = Image.open(full).convert('RGB')
    k = sheet.width / 2000
    for i, cid in enumerate(ids):
        x, y = (i % 10) * 200, (i // 10) * 200
        cell = sheet.crop((int(x * k), int(y * k), int((x + 200) * k), int((y + 200) * k)))
        cell.save(CARDS / f'{cid}.webp', 'WEBP', quality=86, method=6)
    full.unlink()
    print('cards', len(ids), sum((CARDS / f'{c}.webp').stat().st_size for c in ids) // 1024, 'KB')
    pg.close()
    b.close()
(OUT / 'c-meta.json').write_text(json.dumps(meta, ensure_ascii=False, indent=1))
print('done')

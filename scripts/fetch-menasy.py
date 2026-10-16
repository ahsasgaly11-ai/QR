#!/usr/bin/env python3
# ---------------------------------------------------------------------------
# يجلب فهرس «القاموس الإشاري العربي للصم» (menasy.com — مجّاني لخدمة مجتمع الصمّ،
# يسمح بالفهرسة في robots.txt) وصوره المتحرّكة، ويكتب خريطة CSV للمستورد العامّ
# (scripts/import-signs.mjs). ترخيصه: «للاستخدام التعليمي والشخصي» — لا يُجاز تجاريًّا
# دون إذن مكتوب من أصحابه (src/data/sign-licenses.json).
#
#   python3 scripts/fetch-menasy.py --out /tmp/menasy        # map.csv + gif/
#   node scripts/import-signs.mjs --map /tmp/menasy/map.csv --src /tmp/menasy/gif \
#        --source menasy --category menasy --title "القاموس الإشاري العربي للصم" --crop none --size 360 --fps native
#   npm run sign:poses -- --only words/menasy --hand-model hand_landmarker.task && python3 scripts/pose-quality.py --only words/menasy
#   npm run sign:manifest
#
# مهذّب: طلبان متوازيان كحدّ أقصى ومهلة بين الطلبات، ويعيد استخدام ما نُزّل.
# ---------------------------------------------------------------------------
import argparse
import concurrent.futures as cf
import csv
import html
import os
import re
import time
import urllib.request

BASE = 'https://menasy.com'
UA = {'User-Agent': 'QR-sign-dictionary-importer/1.0 (educational, deaf students)'}


def get(url, binary=False, tries=3):
    for k in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
                data = r.read()
                return data if binary else data.decode('utf8', 'ignore')
        except Exception:  # noqa: BLE001
            time.sleep(2 * (k + 1))
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True)
    ap.add_argument('--workers', type=int, default=2)
    a = ap.parse_args()
    gif_dir = os.path.join(a.out, 'gif')
    os.makedirs(gif_dir, exist_ok=True)
    sm = get(BASE + '/sitemap.xml')
    urls = [u for u in re.findall(r'<loc>([^<]+)</loc>', sm or '') if '/signs/' in u]
    print(len(urls), 'sign pages')

    def one(url):
        h = get(url)
        if not h:
            return None
        name = re.search(r'"@type":"DefinedTerm"[^}]*?"name":"([^"]+)"(?:,"alternateName":"([^"]*)")?', h)
        # صورة الإشارة نفسها (معرّفها آخر المسار: …/bad-the-worst-b0015/) لا صور الإشارات المجاورة
        sid = re.escape(url.rstrip('/').rsplit('-', 1)[-1])
        gif = re.search(r'(/signs/\d+/' + sid + r'\.gif)', h) or re.search(r'(/signs/\d+/[a-z]?\d+\.gif)', h)
        cat = re.search(r'href="/categories/([^"/]+)/"', h)
        if not name or not gif:
            return None
        rel = gif.group(1)[len('/signs/'):]
        dst = os.path.join(gif_dir, rel)
        if not os.path.exists(dst):
            data = get(BASE + gif.group(1), binary=True)
            if not data:
                return None
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            open(dst, 'wb').write(data)
            time.sleep(0.25)
        return (html.unescape(name.group(1)).strip(), (name.group(2) or '').strip(), rel, cat.group(1) if cat else '')

    rows = []
    with cf.ThreadPoolExecutor(a.workers) as ex:
        for i, r in enumerate(ex.map(one, urls)):
            if r:
                rows.append(r)
            if i % 100 == 0:
                print(i, len(rows), flush=True)
    with open(os.path.join(a.out, 'map.csv'), 'w', encoding='utf8', newline='') as f:
        w = csv.writer(f)
        w.writerow(['key', 'gloss', 'file', 'aliases', 'category', 'en', 'menasy_category'])
        for ar, en, rel, cat in rows:
            # «حافلة (باص)» → المفتاح «حافلة» والاسم المستعار «باص»
            parts = [p.strip() for p in re.split(r'\s*[/()،,]\s*', ar) if p.strip()]
            key = parts[0] if parts else ar
            w.writerow([key, ar, rel, '|'.join(parts[1:]), 'menasy', en, cat])
    print('✅', len(rows), 'signs →', os.path.join(a.out, 'map.csv'))


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
# ---------------------------------------------------------------------------
# يضيف إلى خطة القاموس (dictionary-plan.json) كل إشارات قاعدة KArSL-502 التي لم
# تُستورد بعد، من ملف تسمياتها الرسمي (KARSL-502_Labels.xlsx)، فيؤدّيها المترجم
# ثلاثي الأبعاد كلمات بدل تهجئتها حرفًا حرفًا.
#
#   python3 scripts/plan-karsl-502.py --labels KARSL-502_Labels.xlsx
#   node scripts/import-karsl.mjs --src <مجلّد 0001/ 0002/ …>   # يحوّل المقاطع
#   npm run sign:poses && npm run sign:manifest
#
# • التسمية «أ / ب» أو «أ (ب)» → المفتاح «أ» والباقي أسماء مستعارة.
# • لا يُستبدل عنصر موجود: إن كان المفتاح (أو اسم مستعار) مملوكًا لإشارة بمقطع
#   محلي يُتخطّى؛ وإن كان مأخوذًا من قاموس يوتيوب فقط، تُضاف إشارة KArSL مكانه في
#   المترجم (المترجم لا يؤدّي إلا ما له حركة محلية).
# • الحروف (0001–0039 تقريبًا) والأرقام موجودة مسبقًا فتُتخطّى تلقائيًّا.
# ---------------------------------------------------------------------------
import argparse
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLAN = os.path.join(ROOT, 'public', 'sign', 'dictionary-plan.json')

MARKS = re.compile('[ً-ْٰـ]')


def normalize(s):
    s = MARKS.sub('', str(s).strip())
    s = re.sub('[٠-٩]', lambda m: str(ord(m.group()) - 0x660), s)
    s = re.sub('[إأآٱ]', 'ا', s).replace('ى', 'ي').replace('ؤ', 'و').replace('ئ', 'ي').replace('ة', 'ه')
    return re.sub(r'\s+', ' ', s).lower()


def split_label(label):
    """«مريض / مرض» ، «سعيد (مسرور)» ، «شهيق - زفير» → [المفتاح، أسماء مستعارة…]"""
    s = re.sub(r'[A-Za-z]+', '', str(label))
    parts = re.split(r'\s*[/()\-–،,]\s*', s)
    parts = [p.strip() for p in parts if p and p.strip()]
    return parts


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--labels', required=True)
    a = ap.parse_args()
    import openpyxl
    rows = list(openpyxl.load_workbook(a.labels).active.iter_rows(values_only=True))[1:]
    plan = json.load(open(PLAN, encoding='utf8'))

    have_ids = {w.get('karsl') for c in plan['categories'] for w in c['words'] if w.get('karsl')}
    have_ids |= {l.get('karsl') for l in plan.get('letters', []) if l.get('karsl')}
    owned = set()  # مفاتيح لها إشارة بمقطع محلي (لا يوتيوب)
    for c in plan['categories']:
        for w in c['words']:
            if w.get('yt'):
                continue
            owned.add(normalize(w['key']))
            for al in w.get('aliases', []):
                owned.add(normalize(al))

    cat = next((c for c in plan['categories'] if c['id'] == 'karsl'), None)
    if cat is None:
        cat = {'id': 'karsl', 'title': 'مفردات عامّة (قاعدة KArSL-502)', 'words': []}
        plan['categories'].append(cat)
    added = skipped = 0
    for sid, ar, en in rows:
        if not isinstance(sid, int) or sid in have_ids:
            continue
        parts = split_label(ar)
        if not parts or len(normalize(parts[0])) < 2:  # حروف وأرقام مفردة
            skipped += 1
            continue
        key = parts[0]
        if normalize(key) in owned:
            skipped += 1
            continue
        aliases = [p for p in parts[1:] if normalize(p) not in owned and len(normalize(p)) >= 2]
        item = {'key': key, 'gloss': ' / '.join(parts) if len(parts) > 1 else key,
                'file': f'words/karsl/karsl-{sid}.mp4', 'karsl': sid, 'source': 'karsl'}
        if aliases:
            item['aliases'] = aliases
        if en:
            item['en'] = str(en).strip()
        cat['words'].append(item)
        owned.add(normalize(key))
        for al in aliases:
            owned.add(normalize(al))
        added += 1
    json.dump(plan, open(PLAN, 'w', encoding='utf8'), ensure_ascii=False, indent=2)
    open(PLAN, 'a', encoding='utf8').write('\n')
    print(f'✅ أُضيف {added} إشارة من KArSL-502 (تُخطّي {skipped} حرفًا/رقمًا/مكرّرًا). الفئة: {cat["title"]} ({len(cat["words"])})')


if __name__ == '__main__':
    main()

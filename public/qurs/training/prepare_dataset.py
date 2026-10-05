#!/usr/bin/env python3
"""يحوّل ملفات العينات المصدَّرة من التطبيق (qurs-samples-*.jsonl) إلى مجموعة بيانات بصيغة YOLO.

الاستخدام:
    python3 prepare_dataset.py qurs-samples-2026-10-05.jsonl [المزيد.jsonl ...] --out dataset

المخرجات:
    dataset/images/{train,val}/*.jpg
    dataset/labels/{train,val}/*.txt   (class cx cy w h، نسب من ٠ إلى ١)
    dataset/data.yaml
"""
import argparse, base64, json, os, random

ap = argparse.ArgumentParser()
ap.add_argument('files', nargs='+'); ap.add_argument('--out', default='dataset'); ap.add_argument('--val', type=float, default=0.15); ap.add_argument('--seed', type=int, default=7)
a = ap.parse_args()
random.seed(a.seed)
rows = []
for f in a.files:
    with open(f, encoding='utf-8') as fh:
        for line in fh:
            line = line.strip()
            if line: rows.append(json.loads(line))
print('العينات:', len(rows))
random.shuffle(rows)
nval = max(1, int(len(rows) * a.val)) if len(rows) > 5 else 0
for split in ('train', 'val'):
    os.makedirs(f'{a.out}/images/{split}', exist_ok=True); os.makedirs(f'{a.out}/labels/{split}', exist_ok=True)
for i, r in enumerate(rows):
    split = 'val' if i < nval else 'train'
    name = r.get('id') or f's{i}'
    jpg = r['jpg'].split(',', 1)[1]
    with open(f'{a.out}/images/{split}/{name}.jpg', 'wb') as fh: fh.write(base64.b64decode(jpg))
    W, H = r['w'], r['h']
    with open(f'{a.out}/labels/{split}/{name}.txt', 'w') as fh:
        for b in r.get('boxes', []):
            d = b['r'] * 2.2  # المربع أوسع قليلًا من الكرة
            fh.write(f"0 {b['x']/W:.6f} {b['y']/H:.6f} {d/W:.6f} {d/H:.6f}\n")
with open(f'{a.out}/data.yaml', 'w', encoding='utf-8') as fh:
    fh.write(f"path: {os.path.abspath(a.out)}\ntrain: images/train\nval: images/val\nnames:\n  0: ball\n")
print('جاهز:', a.out, '| تدريب:', len(rows) - nval, '| تحقق:', nval)

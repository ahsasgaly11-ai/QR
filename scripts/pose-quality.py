#!/usr/bin/env python3
# ---------------------------------------------------------------------------
# بوّابة جودة لبنك الحركات: الإشارة الخاطئة أضرّ من غيابها. يفحص كل ملف حركة
# ويعزل (ينقل إلى poses-rejected/) ما لا يصلح ليؤدّيه المترجم ثلاثي الأبعاد:
#   • الجسم مكشوف في أقلّ من 70% من الإطارات
#   • اليد المؤدّية (المرفوعة) مكشوفة أصابعها في أقلّ من 60% من إطارات الأداء
#   • أداء أقصر من 0.4 ثانية (6 إطارات بمعدّل 15/ث)
# الإشارة المعزولة يهجّيها المترجم حرفًا حرفًا بدل أن يؤدّيها خطأً، ويبقى مقطعها
# متاحًا للمترجم المعتمد ليراجعه.
#
#   python3 scripts/pose-quality.py [--only words/menasy] [--dry]
# ---------------------------------------------------------------------------
import argparse
import glob
import json
import os
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POSES = os.path.join(ROOT, 'public', 'sign', 'poses')
REJ = os.path.join(ROOT, 'public', 'sign', 'poses-rejected')


def check(d):
    fr = d.get('frames', [])
    n = len(fr)
    if not n:
        return 'empty'
    body = [f for f in fr if f.get('p')]
    if len(body) < 0.7 * n:
        return f'body {len(body)}/{n}'
    # إطارات الأداء: إحدى اليدين فوق مستوى الخصر تقريبًا
    act = []
    for f in body:
        p = f['p']
        w = abs(p[11][0] - p[12][0]) or 0.2
        waist = (p[11][1] + p[12][1]) / 2 + 1.1 * w
        up_l = p[15][1] < waist
        up_r = p[16][1] < waist
        if up_l or up_r:
            act.append((f, up_l, up_r))
    # بالزمن لا بعدد الإطارات: مصادر الصور المتحرّكة 4–6 إطارات/ث
    if len(act) < max(3, round(0.4 * (d.get('fps') or 15))):
        return f'active {len(act)}'
    seen = sum(1 for f, ul, ur in act if (ul and (f.get('l') or f.get('L'))) or (ur and (f.get('r') or f.get('R'))))
    if seen < 0.6 * len(act):
        return f'hands {seen}/{len(act)}'
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', default='')
    ap.add_argument('--dry', action='store_true')
    a = ap.parse_args()
    files = sorted(glob.glob(os.path.join(POSES, a.only, '**', '*.json'), recursive=True))
    bad = 0
    for p in files:
        try:
            why = check(json.load(open(p, encoding='utf8')))
        except Exception as e:  # noqa: BLE001
            why = f'error {e}'
        if why:
            bad += 1
            rel = os.path.relpath(p, POSES)
            print(f'✗ {rel}: {why}')
            if not a.dry:
                dst = os.path.join(REJ, rel)
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                shutil.move(p, dst)
    print(f'\n✅ فُحص {len(files)} ملفًّا؛ عُزل {bad} لضعف الكشف{" (تجربة فقط)" if a.dry else ""}.')


if __name__ == '__main__':
    main()

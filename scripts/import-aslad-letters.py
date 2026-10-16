#!/usr/bin/env python3
# ---------------------------------------------------------------------------
# أشكال يد التهجئة من قاعدة ASLAD-190K (رخصة CC BY 4.0 — مُجازة تجاريًّا مع النسب):
#   Arabic Sign Language Alphabet Dataset, Mendeley Data, doi:10.17632/2fgpn5dwgc.2
#
# لكل حرف: يكشف معالم اليد بالمتر (MediaPipe Hand Landmarker) في عيّنة من الصور،
# ويحاذي العيّنات على عظام الكفّ الثابتة (Procrustes)، ويأخذ الوسيط لكل مفصل بعد
# استبعاد الشاذّ — فينتج شكل يد «إجماعيًّا» لا يحمل ضجيج صورة واحدة — واتجاهَ كفٍّ
# هو متوسّط اتجاهات العيّنات. ثم يكتب ملف حركة (بصيغة بنك الحركات v3) يؤدّي فيه
# المترجم ثلاثي الأبعاد الحرف باليمنى أمام الصدر، ويضيف الحقل aslad إلى الحرف في
# خطة القاموس. لا شيء من مقاطع KArSL يدخل هذه الملفات.
#
#   python3 scripts/import-aslad-letters.py --zip ASLAD-96K.zip \
#       --hand-model hand_landmarker.task [--per 150] [--cache /tmp/aslad-det.json]
#   npm run sign:manifest
# ---------------------------------------------------------------------------
import argparse
import collections
import json
import os
import random
import zipfile

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SIGN_DIR = os.path.join(ROOT, 'public', 'sign')
PLAN = os.path.join(SIGN_DIR, 'dictionary-plan.json')
OUT_REL = 'letters-aslad'  # داخل public/sign/poses/

# مجلّدات ASLAD ← حروفنا (من لوحة الحروف المرفقة بالقاعدة ASLAD-190K_Letters.jpg).
# «al» (ال) و«la» (لا) ليستا حرفين مفردين في التهجئة حرفًا حرفًا فتُتركان.
ASLAD_TO_LETTER = {
    'aleff': 'ا', 'bb': 'ب', 'taa': 'ت', 'thaa': 'ث', 'jeem': 'ج', 'haa': 'ح', 'khaa': 'خ',
    'dal': 'د', 'thal': 'ذ', 'ra': 'ر', 'zay': 'ز', 'seen': 'س', 'sheen': 'ش', 'saad': 'ص',
    'dhad': 'ض', 'ta': 'ط', 'dha': 'ظ', 'ain': 'ع', 'ghain': 'غ', 'fa': 'ف', 'gaaf': 'ق',
    'kaaf': 'ك', 'laam': 'ل', 'meem': 'م', 'nun': 'ن', 'ha': 'ه', 'waw': 'و', 'ya': 'ي',
    'toot': 'ة', 'yaa': 'ئ',
}
PALM = [0, 1, 5, 9, 13, 17]  # نقاط الكفّ شبه الصلبة: أساس المحاذاة


def detect(zpath, model, per, seed=7):
    import cv2
    import mediapipe as mp
    from mediapipe.tasks import python as mpp
    from mediapipe.tasks.python import vision

    z = zipfile.ZipFile(zpath)
    by = collections.defaultdict(list)
    for n in z.namelist():
        if n.lower().endswith('.jpg'):
            by[n.split('/')[1]].append(n)
    det = vision.HandLandmarker.create_from_options(vision.HandLandmarkerOptions(
        base_options=mpp.BaseOptions(model_asset_path=model), num_hands=1,
        min_hand_detection_confidence=0.5))
    rnd = random.Random(seed)
    res = {}
    try:
        for folder, names in sorted(by.items()):
            if folder not in ASLAD_TO_LETTER:
                continue
            rnd.shuffle(names)
            got = []
            for n in names:
                if len(got) >= per:
                    break
                img = cv2.imdecode(np.frombuffer(z.read(n), np.uint8), cv2.IMREAD_COLOR)
                if img is None:
                    continue
                r = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB)))
                if not r.hand_world_landmarks:
                    continue
                got.append({'n': n, 'hd': r.handedness[0][0].category_name,
                            'W': [[p.x, p.y, p.z] for p in r.hand_world_landmarks[0]]})
            res[folder] = got
            print(f'  {folder}: {len(got)} عيّنة', flush=True)
    finally:
        det.close()
    return res


def kabsch(A, B):
    """دوران R (صحيح، det=+1) يقلّل |A·R − B| — صفوف النقاط متمركزة."""
    H = A.T @ B
    U, _, Vt = np.linalg.svd(H)
    d = np.sign(np.linalg.det(U @ Vt))
    D = np.diag([1, 1, d])
    return U @ D @ Vt


def quat_from_mat(R):
    # مصفوفة دوران (تُطبَّق على صفوف: v·R) → رباعي (w, x, y, z) للمصفوفة المنقولة
    M = R.T
    t = np.trace(M)
    if t > 0:
        s = np.sqrt(t + 1.0) * 2
        q = [0.25 * s, (M[2, 1] - M[1, 2]) / s, (M[0, 2] - M[2, 0]) / s, (M[1, 0] - M[0, 1]) / s]
    else:
        i = int(np.argmax([M[0, 0], M[1, 1], M[2, 2]]))
        if i == 0:
            s = np.sqrt(1.0 + M[0, 0] - M[1, 1] - M[2, 2]) * 2
            q = [(M[2, 1] - M[1, 2]) / s, 0.25 * s, (M[0, 1] + M[1, 0]) / s, (M[0, 2] + M[2, 0]) / s]
        elif i == 1:
            s = np.sqrt(1.0 + M[1, 1] - M[0, 0] - M[2, 2]) * 2
            q = [(M[0, 2] - M[2, 0]) / s, (M[0, 1] + M[1, 0]) / s, 0.25 * s, (M[1, 2] + M[2, 1]) / s]
        else:
            s = np.sqrt(1.0 + M[2, 2] - M[0, 0] - M[1, 1]) * 2
            q = [(M[1, 0] - M[0, 1]) / s, (M[0, 2] + M[2, 0]) / s, (M[1, 2] + M[2, 1]) / s, 0.25 * s]
    q = np.array(q)
    return q / np.linalg.norm(q)


def mat_from_quat(q):
    w, x, y, z = q
    M = np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ])
    return M.T


def canonical(samples):
    """شكل اليد الإجماعي (بالمتر، محاور الكاميرا) + مقاييس التشتّت."""
    X = []
    for s in samples:
        if s['hd'] != 'Right':  # تُستبعد العيّنات النادرة ذات اليد المعكوسة
            continue
        W = np.array(s['W'], float)
        W = W - W[0]
        sc = np.linalg.norm(W[9])
        if sc < 1e-4:
            continue
        X.append((W / sc, sc))
    if len(X) < 20:
        return None
    shapes = [x for x, _ in X]
    scale = float(np.median([s for _, s in X]))
    ref = shapes[0]
    for _ in range(4):
        rc = ref[PALM] - ref[PALM].mean(0)
        Rs = [kabsch(x[PALM] - x[PALM].mean(0), rc) for x in shapes]
        aligned = [x @ R for x, R in zip(shapes, Rs)]
        ref = np.median(np.stack(aligned), 0)
    # استبعاد الشاذّ (أسوأ 20%) ثم وسيط نهائي
    res = np.array([np.linalg.norm(a - ref, axis=1).mean() for a in aligned])
    keep = res <= np.quantile(res, 0.8)
    aligned_k = [a for a, k in zip(aligned, keep) if k]
    canon = np.median(np.stack(aligned_k), 0)
    # الاتجاه: متوسّط دورانات العيّنات (من المرجع إلى العيّنة)
    qs = [quat_from_mat(R.T) for R, k in zip(Rs, keep) if k]
    q0 = qs[0]
    qs = [q if np.dot(q, q0) >= 0 else -q for q in qs]
    qm = np.mean(qs, 0)
    qm /= np.linalg.norm(qm)
    Q = mat_from_quat(qm)
    cam = canon @ Q
    ang = [np.degrees(2 * np.arccos(min(1.0, abs(float(np.dot(q, qm)))))) for q in qs]
    return {
        'W': (cam * scale),
        'spread': float(np.median(res[keep])),  # بوحدة (المعصم ← قاعدة الوسطى)
        'orient': float(np.median(ang)),  # درجات
        'n': int(keep.sum()),
    }


# ---- ملف الحركة: وضع تهجئة عامّ (أرقام مصمَّمة، لا مأخوذة من مقطع) ----
def body(t):
    """25 نقطة جسم بإحداثيات الصورة المطبّعة (x, y, z, ظهور). t ∈ [0,1] تقدّم الرفع."""
    P = [[0.5, 0.42, -0.8, 1.0]] * 25
    P = [list(p) for p in P]
    eye = lambda dx, dy: [0.5 + dx, 0.40 + dy, -0.75, 1.0]  # noqa: E731
    for i, (dx, dy) in enumerate([(-0.012, -0.02), (-0.022, -0.02), (-0.032, -0.02), (0.012, -0.02),
                                  (0.022, -0.02), (0.032, -0.02), (-0.05, -0.01), (0.05, -0.01),
                                  (-0.015, 0.03), (0.015, 0.03)], start=1):
        P[i] = eye(dx, dy)
    P[0] = [0.5, 0.43, -0.8, 1.0]
    P[11] = [0.65, 0.56, 0.0, 1.0]   # الكتف الأيسر (يمين الصورة)
    P[12] = [0.35, 0.56, 0.0, 1.0]   # الكتف الأيمن
    P[13] = [0.72, 0.77, 0.0, 1.0]   # اليسرى مرتخية
    P[15] = [0.70, 0.96, -0.2, 1.0]
    lift = 0.5 - 0.5 * np.cos(np.pi * t)
    P[14] = [0.31, 0.80, -0.35, 1.0]  # مرفق اليمنى
    P[16] = [0.37, 0.70 - 0.07 * lift, -0.6 - 0.45 * lift, 1.0]  # المعصم أمام الصدر
    for i, base in ((17, 15), (19, 15), (21, 15), (18, 16), (20, 16), (22, 16)):
        P[i] = [P[base][0], P[base][1] - 0.03, P[base][2], 0.9]
    P[23] = [0.59, 0.95, 0.0, 0.8]
    P[24] = [0.41, 0.95, 0.0, 0.8]
    return [[round(v, 3) for v in p] for p in P]


def pose_file(W, key):
    W = np.asarray(W, float)
    Wc = W - W.mean(0)  # معالم MediaPipe بالمتر متمركزة حول اليد
    frames = []
    n_in, n_hold = 3, 9  # رفع قصير ثم ثبات ~0.6 ث بمعدّل 15/ث
    for i in range(n_in + n_hold):
        t = min(1.0, (i + 1) / n_in)
        p = body(t)
        wx, wy = p[16][0], p[16][1]
        img = [[round(wx + (q[0] - W[0][0]) * 0.75, 4), round(wy + (q[1] - W[0][1]) * 0.75, 4),
                round((q[2] - W[0][2]) * 0.75, 4)] for q in W]
        frames.append({'p': p, 'l': None, 'r': img, 'L': None,
                       'R': [[round(float(v), 5) for v in q] for q in Wc], 'h': None, 'f': None})
    return {'v': 3, 'fps': 15, 'ar': 1, 'src': f'aslad:{key}', 'fk': [], 'frames': frames,
            'license': 'CC BY 4.0 — ASLAD-190K (doi:10.17632/2fgpn5dwgc.2); شكل إجماعي مشتقّ'}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--zip', help='ASLAD-96K.zip (أو ASLAD-190K.zip)')
    ap.add_argument('--hand-model', help='hand_landmarker.task')
    ap.add_argument('--per', type=int, default=150, help='عيّنات لكل حرف')
    ap.add_argument('--cache', default='', help='ملف JSON لنتائج الكشف (يُعاد استخدامه)')
    a = ap.parse_args()

    if a.cache and os.path.exists(a.cache):
        det = json.load(open(a.cache))
    else:
        if not a.zip or not a.hand_model:
            ap.error('--zip و --hand-model مطلوبان (أو --cache موجود)')
        print('… كشف معالم اليد')
        det = detect(a.zip, a.hand_model, a.per)
        if a.cache:
            json.dump(det, open(a.cache, 'w'))

    plan = json.load(open(PLAN, encoding='utf8'))
    by_key = {l['key']: l for l in plan.get('letters', [])}
    out_dir = os.path.join(SIGN_DIR, 'poses', OUT_REL)
    os.makedirs(out_dir, exist_ok=True)
    report = []
    for folder, key in ASLAD_TO_LETTER.items():
        c = canonical(det.get(folder, []))
        item = by_key.get(key)
        if not c or not item:
            report.append(f'⚠️ {key} ({folder}): تُخطّى')
            continue
        name = os.path.splitext(os.path.basename(item['file']))[0]
        rel = f'{OUT_REL}/{name}.json'
        with open(os.path.join(SIGN_DIR, 'poses', rel), 'w', encoding='utf8') as f:
            json.dump(pose_file(c['W'], key), f, ensure_ascii=False, separators=(',', ':'))
        item['aslad'] = rel
        report.append(f'{key} ({folder}): {c["n"]} عيّنة، تشتّت الشكل {c["spread"]:.3f}، تشتّت الاتجاه {c["orient"]:.0f}°')
    json.dump(plan, open(PLAN, 'w', encoding='utf8'), ensure_ascii=False, indent=2)
    open(PLAN, 'a', encoding='utf8').write('\n')
    print('\n'.join(report))
    print(f'\n✅ {sum(1 for r in report if not r.startswith("⚠️"))} حرفًا → public/sign/poses/{OUT_REL}/')


if __name__ == '__main__':
    main()

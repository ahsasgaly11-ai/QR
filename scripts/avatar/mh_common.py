#!/usr/bin/env python3
# ---------------------------------------------------------------------------
# أدوات مشتركة لبناء شخصية المترجم من بيانات MakeHuman (رخصة CC0):
# قراءة الشبكة الأساسية base.obj، وتطبيق «الأهداف» (targets: إزاحات رؤوس)،
# ومراكز مفاصل الهيكل من «مكعّبات المفاصل» المساعدة، والتحويل إلى فضاء Blender.
#
# البيانات تأتي من حزمة MPFB (إضافة Blender لمجتمع MakeHuman) — نستعمل ملفّاتها
# فقط (شبكة، أهداف، تعريف هيكل، أوزان) دون تشغيل شيفرتها:
#   https://extensions.blender.org/add-ons/mpfb/  → add-on-mpfb-vX.zip → فكّ الضغط
#   ثم مرّر مجلّد data/ إلى السكربتات عبر --mhdata
#
# تعمل بـ Python النظام وبـ Python المدمج في Blender (numpy فقط).
# ---------------------------------------------------------------------------
import gzip
import json
import os

import numpy as np

BODY_VERTS = 13380  # رؤوس الجسم 0..13379؛ ما بعدها هندسة مساعدة ومكعّبات مفاصل


def load_obj(path):
    """يقرأ base.obj: رؤوس (dm، Y للأعلى، +Z للأمام)، إحداثيات نسيج، وجوه مع مجموعاتها."""
    V, VT, faces = [], [], []
    g = None
    with open(path, encoding='utf8') as f:
        for line in f:
            if line.startswith('v '):
                p = line.split()
                V.append((float(p[1]), float(p[2]), float(p[3])))
            elif line.startswith('vt '):
                p = line.split()
                VT.append((float(p[1]), float(p[2])))
            elif line.startswith('g '):
                g = line[2:].strip()
            elif line.startswith('f '):
                vi, ti = [], []
                for part in line.split()[1:]:
                    a = part.split('/')
                    vi.append(int(a[0]) - 1)
                    ti.append(int(a[1]) - 1 if len(a) > 1 and a[1] else -1)
                faces.append((g, vi, ti))
    return {'V': np.array(V, dtype=np.float64), 'VT': np.array(VT, dtype=np.float64), 'faces': faces}


def load_vgroups(path):
    with open(path, encoding='utf8') as f:
        return json.load(f)


def group_indices(vg, name):
    return [i for a, b in vg[name] for i in range(a, b + 1)]


def load_target(path):
    """ملف هدف: سطور «index dx dy dz» (مضغوط gz أو نصّ)."""
    opener = gzip.open if path.endswith('.gz') else open
    idx, dl = [], []
    with opener(path, 'rt', encoding='utf8') as f:
        for line in f:
            if not line or line[0] == '#':
                continue
            p = line.split()
            if len(p) < 4:
                continue
            idx.append(int(p[0]))
            dl.append((float(p[1]), float(p[2]), float(p[3])))
    if not idx:
        return np.zeros(0, dtype=np.int64), np.zeros((0, 3))
    return np.array(idx, dtype=np.int64), np.array(dl, dtype=np.float64)


def target_delta(path, n):
    """الهدف كمصفوفة إزاحات كاملة (n×3)."""
    d = np.zeros((n, 3))
    idx, dl = load_target(path)
    if len(idx):
        d[idx] += dl
    return d


def apply_targets(V, weighted_paths):
    out = V.copy()
    for path, w in weighted_paths:
        if abs(w) < 1e-6 or not os.path.exists(path):
            continue
        idx, dl = load_target(path)
        if len(idx):
            out[idx] += dl * w
    return out


def _parts_weights(value, parts):
    """أوزان فئات متغيّر ماكرو (كما في macro.json): خطّي داخل كل جزء."""
    w = {}
    for p in parts:
        lo, hi = p['lowest'], p['highest']
        if lo <= value <= hi:
            t = (value - lo) / (hi - lo) if hi > lo else 0.0
            if p['low']:
                w[p['low']] = w.get(p['low'], 0.0) + (1 - t)
            if p['high']:
                w[p['high']] = w.get(p['high'], 0.0) + t
            return w
    # خارج المدى: الطرف الأقرب
    p = parts[0] if value < parts[0]['lowest'] else parts[-1]
    key = p['low'] if value < parts[0]['lowest'] else p['high']
    return {key: 1.0} if key else {}


def macro_targets(data_dir, gender=1.0, age=0.5, muscle=0.5, weight=0.5, height=0.5,
                  proportions=0.5, ethnic=None):
    """قائمة (مسار، وزن) لأهداف الماكرو: العرق×الجنس×العمر، والطول، والتناسب، والعضل/الوزن."""
    ethnic = ethnic or {'caucasian': 1.0}
    macro = json.load(open(os.path.join(data_dir, 'targets', 'macrodetails', 'macro.json'), encoding='utf8'))
    mt = macro['macrotargets']
    g = _parts_weights(gender, mt['gender']['parts'])
    a = _parts_weights(age, mt['age']['parts'])
    m = _parts_weights(muscle, mt['muscle']['parts'])
    wt = _parts_weights(weight, mt['weight']['parts'])
    h = _parts_weights(height, mt['height']['parts'])
    pr = _parts_weights(proportions, mt['proportions']['parts'])
    base = os.path.join(data_dir, 'targets', 'macrodetails')
    out = []
    for e, we in ethnic.items():
        for gk, wg in g.items():
            for ak, wa in a.items():
                out.append((os.path.join(base, f'{e}-{gk}-{ak}.target.gz'), we * wg * wa))
    for gk, wg in g.items():
        for ak, wa in a.items():
            for mk, wm in m.items():
                for wk, ww in wt.items():
                    out.append((os.path.join(base, f'universal-{gk}-{ak}-{mk}-{wk}.target.gz'), wg * wa * wm * ww))
                    for hk, wh in h.items():
                        out.append((os.path.join(base, 'height', f'{gk}-{ak}-{mk}-{wk}-{hk}.target.gz'), wg * wa * wm * ww * wh))
                    for pk, wp in pr.items():
                        out.append((os.path.join(base, 'proportions', f'{gk}-{ak}-{mk}-{wk}-{pk}.target.gz'), wg * wa * wm * ww * wp))
    return [(p, w) for p, w in out if w > 1e-6]


def expression_unit_delta(data_dir, unit, ethnic, n):
    """إزاحة وحدة تعبير (مثل mouth-open) ممزوجة بأوزان العرق."""
    d = np.zeros((n, 3))
    for e, we in ethnic.items():
        p = os.path.join(data_dir, 'targets', 'expression', 'units', e, f'{unit}.target.gz')
        if we > 1e-6 and os.path.exists(p):
            d += target_delta(p, n) * we
    return d


def to_blender(V):
    """dm/Y-up/+Z-front (OBJ) → متر/Z-up/-Y-front (Blender)."""
    out = np.empty_like(V)
    out[:, 0] = V[:, 0] * 0.1
    out[:, 1] = -V[:, 2] * 0.1
    out[:, 2] = V[:, 1] * 0.1
    return out


def joint_center(V, vg, name):
    return V[group_indices(vg, name)].mean(axis=0)


# تعابير الوجه التي تؤدّيها الشخصية (نفس الترتيب في src/lib/sign-motion.ts)
# → وحدات تعبير MakeHuman المكوِّنة لها، مع جانب (L/R) للوحدات غير المجنّبة.
FACE_UNITS = {
    'browInnerUp': [('eyebrows-left-inner-up', None), ('eyebrows-right-inner-up', None)],
    'browDownLeft': [('eyebrows-left-down', None)],
    'browDownRight': [('eyebrows-right-down', None)],
    'browOuterUpLeft': [('eyebrows-left-extern-up', None)],
    'browOuterUpRight': [('eyebrows-right-extern-up', None)],
    'eyeBlinkLeft': [('eye-left-closure', None)],
    'eyeBlinkRight': [('eye-right-closure', None)],
    'eyeWideLeft': [('eye-left-opened-up', None)],
    'eyeWideRight': [('eye-right-opened-up', None)],
    'eyeSquintLeft': [('eye-left-slit', None)],
    'eyeSquintRight': [('eye-right-slit', None)],
    'jawOpen': [('mouth-open', None)],
    'mouthSmileLeft': [('mouth-corner-puller', 'L')],
    'mouthSmileRight': [('mouth-corner-puller', 'R')],
    'mouthFrownLeft': [('mouth-depression', 'L')],
    'mouthFrownRight': [('mouth-depression', 'R')],
    'mouthPucker': [('mouth-pursing', None)],
    'mouthFunnel': [('mouth-protusion', None)],
    'mouthStretchLeft': [('mouth-retraction', 'L')],
    'mouthStretchRight': [('mouth-retraction', 'R')],
    'mouthPressLeft': [('mouth-compression', 'L')],
    'mouthPressRight': [('mouth-compression', 'R')],
    'cheekPuff': [],  # هندسي (انتفاخ الخدّين) — يُبنى في سكربت البناء
}
FACE_ORDER = list(FACE_UNITS.keys())


def side_mask(V, side, width=0.6):
    """قناع جانبي ناعم حول خطّ المنتصف (x بوحدة dm): L = +x (يسار الشخصية)."""
    x = V[:, 0]
    t = np.clip((x / width + 1) / 2, 0, 1)
    t = t * t * (3 - 2 * t)
    return t if side == 'L' else 1 - t

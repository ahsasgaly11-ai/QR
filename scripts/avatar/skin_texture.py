#!/usr/bin/env python3
# ---------------------------------------------------------------------------
# يولّد نسيج بشرة شخصية المترجم (skin.jpg) ونسيج العين (iris.png).
#
# المناطق (الشفتان، الحاجبان، اللحية، الشارب، السوالف، داخل الفم، الأظافر،
# احمرار الخدّين والأنف والأذنين) تُحدَّد على الشبكة ثلاثية الأبعاد ثم تُرسم في
# فضاء UV عبر مضلّعات الوجوه — فلا حاجة لمعرفة تخطيط UV يدويًّا. الأقنعة
# الجاهزة من حزمة MPFB (الشفاه، الجفون، الأظافر، داخل الفم، الأذنان) تُستخدم
# حيث تتوفّر.
#
#   python3 scripts/avatar/skin_texture.py --mhdata <mpfb>/data --out public/sign/avatar
# ---------------------------------------------------------------------------
import argparse
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mh_common import (BODY_VERTS, apply_targets, group_indices, joint_center, load_obj,  # noqa: E402
                       load_vgroups, macro_targets)

from character import CHARACTER  # noqa: E402

W = 2048


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def rasterize(faces, VT, vert_w, size=W, blur=4):
    """يرسم وزنًا لكل رأس (0..1) إلى صورة UV: تعبئة كل وجه بمتوسّط أوزان رؤوسه ثم تنعيم."""
    im = Image.new('F', (size, size), 0.0)
    d = ImageDraw.Draw(im)
    for grp, vi, ti in faces:
        if grp != 'body' or -1 in ti:
            continue
        w = float(np.mean(vert_w[vi]))
        if w < 0.01:
            continue
        pts = [(VT[t][0] * size, (1 - VT[t][1]) * size) for t in ti]
        d.polygon(pts, fill=w)
    a = np.clip(np.asarray(im), 0, 1)
    if blur:
        # PIL لا ينعّم صور الفاصلة العائمة: نمرّ عبر 8 بت
        im8 = Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(blur))
        a = np.asarray(im8).astype(np.float32) / 255
    return a


def noise(size, scale, seed):
    rng = np.random.default_rng(seed)
    small = rng.random((size // scale, size // scale)).astype(np.float32)
    return np.asarray(Image.fromarray(small).resize((size, size), Image.BICUBIC))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--mhdata', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    C = CHARACTER

    obj = load_obj(os.path.join(a.mhdata, '3dobjs', 'base.obj'))
    vg = load_vgroups(os.path.join(a.mhdata, 'mesh_metadata', 'basemesh_vertex_groups.json'))
    V = apply_targets(obj['V'], macro_targets(a.mhdata, **C['macro']) + [
        (os.path.join(a.mhdata, 'targets', p + '.target.gz'), w) for p, w in C['details']])
    VT, faces = obj['VT'], obj['faces']
    n = len(V)

    # معالم الوجه (dm، +Z أمام، Y أعلى)
    eyeL = joint_center(V, vg, 'joint-l-eye')
    eyeR = joint_center(V, vg, 'joint-r-eye')
    mouth = joint_center(V, vg, 'joint-mouth')
    jaw = joint_center(V, vg, 'joint-jaw')  # أسفل الذقن تقريبًا
    head = joint_center(V, vg, 'joint-head')
    neck = joint_center(V, vg, 'joint-neck')
    x, y, z = V[:, 0], V[:, 1], V[:, 2]
    front = smoothstep(head[2] - 0.3, head[2] + 0.3, z)  # النصف الأمامي للرأس
    body = np.zeros(n, bool)
    body[:BODY_VERTS] = True

    # --- الحاجبان: قوس فوق كل عين ---
    def brow(eye):
        # حاجب مقوّس فوق كل عين: أسمك في الوسط، يرقّ عند الطرفين، أعلى قليلًا من جهة الصدغ
        side_ = np.sign(eye[0])
        dx = (x - eye[0]) / 0.27
        arch = eye[1] + 0.19 + 0.05 * (1 - dx * dx) + 0.02 * dx * side_
        thick = 0.05 * (1 - 0.45 * dx * dx)
        band = np.exp(-((y - arch) / thick) ** 2) * np.exp(-(dx * 1.0) ** 6)
        return band * front
    brows = np.clip(brow(eyeL) + brow(eyeR), 0, 1)

    # --- اللحية القصيرة والشارب والسوالف ---
    chin_z = jaw[2]
    under_jaw = smoothstep(jaw[1] - 0.45, jaw[1] - 0.15, y)  # لا تنزل إلى الرقبة
    below_lip = 1 - smoothstep(mouth[1] - 0.28, mouth[1] - 0.08, y)  # تحت الشفة السفلى
    cheek_line = 1 - smoothstep(mouth[1] + 0.15, mouth[1] + 0.55, y)  # تتلاشى صعودًا نحو الوجنتين
    side = smoothstep(0.75, 1.15, np.abs(x))  # السوالف/اللحية الجانبية
    beard = np.clip(below_lip * under_jaw + cheek_line * side * under_jaw, 0, 1) * smoothstep(head[2] - 1.2, head[2] - 0.5, z)
    # الشارب: بين الأنف والشفة العليا
    mustache = np.exp(-((y - (mouth[1] + 0.28)) / 0.09) ** 2) * np.exp(-(x / 0.42) ** 4) * front
    # السوالف فوق الفكّ أمام الأذنين
    sideburn = smoothstep(1.0, 1.25, np.abs(x)) * smoothstep(eyeL[1] - 1.1, eyeL[1] - 0.2, y) * (1 - smoothstep(eyeL[1] + 0.2, eyeL[1] + 0.5, y)) * smoothstep(head[2] - 0.9, head[2] - 0.3, z)
    hair = np.clip(beard * C['beard'] + mustache * C['beard'] + sideburn * 0.9, 0, 1)
    # لا شعر على الشفتين (قناع MPFB)
    # --- احمرار خفيف: الوجنتان، الأنف، الأذنان ---
    cheekL = np.exp(-(((x - (eyeL[0] + 0.15)) / 0.45) ** 2 + ((y - (eyeL[1] - 0.55)) / 0.35) ** 2))
    cheekR = np.exp(-(((x - (eyeR[0] - 0.15)) / 0.45) ** 2 + ((y - (eyeR[1] - 0.55)) / 0.35) ** 2))
    nose = np.exp(-((x / 0.22) ** 2 + ((y - (mouth[1] + 0.55)) / 0.4) ** 2)) * front
    blush = np.clip((cheekL + cheekR) * 0.8 + nose * 0.9, 0, 1) * front
    # ظلّ خفيف داخل محجر العين وتحتها (عمق)
    socket = np.clip(np.exp(-(((x - eyeL[0]) / 0.33) ** 2 + ((y - eyeL[1]) / 0.26) ** 2)) + np.exp(-(((x - eyeR[0]) / 0.33) ** 2 + ((y - eyeR[1]) / 0.26) ** 2)), 0, 1) * front

    for arr in (brows, hair, blush, socket):
        arr[~body] = 0

    print('rasterizing…')
    M_brows = rasterize(faces, VT, brows, blur=3)
    M_hair = rasterize(faces, VT, hair, blur=5)
    M_blush = rasterize(faces, VT, blush, blur=10)
    M_socket = rasterize(faces, VT, socket, blur=8)

    def mask(name, blur=0):
        p = os.path.join(a.mhdata, 'textures', f'mpfb_{name}.jpg')
        im = Image.open(p).convert('L').resize((W, W))
        if blur:
            im = im.filter(ImageFilter.GaussianBlur(blur))
        return np.asarray(im).astype(np.float32) / 255
    M_lips = mask('lips', 1)
    M_lids = mask('eyelids')
    M_nails = mask('fingernails')
    M_mouth = mask('inside-mouth')
    M_ears = mask('ears', 6)
    M_face = mask('face', 2)
    M_hair = M_hair * (1 - M_lips) * (1 - M_mouth)

    # --- تركيب اللون ---
    base = np.array(C['skin'], np.float32)
    img = np.ones((W, W, 3), np.float32) * base
    # تنويع طبيعي خفيف (بقع لونية ناعمة + حبيبات)
    n1 = noise(W, 64, 1) - 0.5
    n2 = noise(W, 8, 2) - 0.5
    n3 = noise(W, 2, 3) - 0.5
    img += (n1 * 10 + n2 * 5 + n3 * 4)[..., None]
    img[..., 0] += n1 * 4  # تنويع نحو الأحمر
    # احمرار
    red = np.array([22, -6, -14], np.float32)
    img += M_blush[..., None] * red
    img += M_ears[..., None] * red * 0.6
    # ظلّ المحجر
    img *= (1 - M_socket[..., None] * 0.12)
    # الشفتان
    lipc = np.array(C['lips'], np.float32)
    img = img * (1 - M_lips[..., None] * 0.85) + lipc * M_lips[..., None] * 0.85
    # خطّ الرموش/حافّة الجفن
    img *= (1 - M_lids[..., None] * 0.55)
    # داخل الفم
    img = img * (1 - M_mouth[..., None]) + np.array([92, 28, 30], np.float32) * M_mouth[..., None]
    # الأظافر
    img = img * (1 - M_nails[..., None] * 0.5) + np.array([232, 196, 178], np.float32) * M_nails[..., None] * 0.5
    # الحاجبان: شعيرات داكنة بخشونة
    hairc = np.array(C['hair'], np.float32)
    strands = np.clip(noise(W, 3, 7) * 1.4 - 0.2, 0, 1)
    bro = np.clip(M_brows * (0.65 + 0.5 * strands), 0, 1)
    img = img * (1 - bro[..., None]) + hairc * bro[..., None]
    # اللحية: كثافة بحبيبات (شعر قصير مشذّب)
    grain = np.clip(noise(W, 2, 11) * 1.5 - 0.3, 0, 1) * (0.6 + 0.4 * np.clip(noise(W, 6, 12) * 1.4 - 0.2, 0, 1))
    be = np.clip(M_hair * (0.45 + 0.4 * grain), 0, 0.88)
    beardc = hairc * 0.55 + base * 0.45
    img = img * (1 - be[..., None]) + beardc * be[..., None]
    # الوجه أنعم قليلًا من بقية الجسم (المناطق الأخرى أغمق بدرجة)
    img *= (0.97 + 0.03 * M_face)[..., None]

    out = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
    out.save(os.path.join(a.out, 'skin.jpg'), quality=86, optimize=True)
    print('skin.jpg written')

    # --- نسيج العين: كرة UV قطبها عند مركز القزحية ---
    S = 512
    v = 1 - (np.arange(S) + 0.5) / S  # v=1 في الصفّ الأول (القطب)
    ang = (1 - v) * 180  # الزاوية من القطب بالدرجات
    u = (np.arange(S) + 0.5) / S
    A, U = np.meshgrid(ang, u, indexing='ij')
    iris_r, pupil_r, limbus = 27.0, 8.5, 3.5
    eye = np.ones((S, S, 3), np.float32) * np.array([247, 243, 238], np.float32)
    # أوردة خفيفة جدًّا قرب الحافّة
    vein = (noise(S, 4, 21) > 0.78) * smoothstep(40, 90, A)
    eye -= vein[..., None] * np.array([10, 40, 40], np.float32) * 0.5
    ic = np.array(C['iris'], np.float32)
    fib = 0.75 + 0.5 * (noise(S, 1, 31) * 0.5 + 0.5 * np.abs(np.sin(U * np.pi * 70)))
    t = A / iris_r
    irisc = ic * fib[..., None] * (0.55 + 0.75 * np.clip(t, 0, 1))[..., None]  # أفتح نحو الحافّة ثم حلقة داكنة
    iris_m = 1 - smoothstep(iris_r - 1.2, iris_r + 0.6, A)
    limb = smoothstep(iris_r - limbus - 2, iris_r, A) * iris_m
    irisc *= (1 - limb * 0.6)[..., None]
    eye = eye * (1 - iris_m[..., None]) + irisc * iris_m[..., None]
    pupil = 1 - smoothstep(pupil_r - 0.8, pupil_r + 0.6, A)
    eye *= (1 - pupil * 0.97)[..., None]
    Image.fromarray(np.clip(eye, 0, 255).astype(np.uint8)).save(os.path.join(a.out, 'iris.png'))
    print('iris.png written')


if __name__ == '__main__':
    main()

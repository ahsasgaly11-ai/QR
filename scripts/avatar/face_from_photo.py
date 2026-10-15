#!/usr/bin/env python3
# ---------------------------------------------------------------------------
# يُسقط وجه الصورة المرجعية على نسيج رأس الشخصية.
#
# الطريقة: معالم الوجه (MediaPipe، 468 نقطة) في الصورة المرجعية وفي رسم أمامي
# للرأس ثلاثي الأبعاد بكاميرا معروفة (render_front.py) → تشويه لوحي رقيق (TPS)
# من فضاء الرسم إلى فضاء الصورة → لكل تكسل في منطقة الوجه من خريطة UV: موضعه
# ثلاثي الأبعاد ← بكسل الرسم ← بكسل الصورة ← لونه. يُمزج مع النسيج المولَّد
# (skin_texture.py) بحسب مواجهة السطح للأمام وضمن بيضوي الوجه، فتبقى الجوانب
# والرقبة من النسيج المولَّد بلون مطابق.
#
#   python3 scripts/avatar/face_from_photo.py --mhdata <data> --photo <ref.png> \
#       --front <dir of front.png/front-cam.json> --model face_landmarker.task --out public/sign/avatar
# ---------------------------------------------------------------------------
import argparse
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mh_common import (BODY_VERTS, apply_targets, joint_center, load_obj, load_vgroups,  # noqa: E402
                       macro_targets, to_blender)
from character import CHARACTER  # noqa: E402

W = 2048
# بيضوي الوجه في MediaPipe (ترتيب حول الوجه)
OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152,
        148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
BROW_TOP = [70, 63, 105, 66, 107, 336, 296, 334, 293, 300]


def landmarks(model, path):
    import mediapipe as mp
    from mediapipe.tasks import python as mpp
    from mediapipe.tasks.python import vision
    opts = vision.FaceLandmarkerOptions(base_options=mpp.BaseOptions(model_asset_path=model),
                                        running_mode=vision.RunningMode.IMAGE, num_faces=1)
    lm = vision.FaceLandmarker.create_from_options(opts)
    im = Image.open(path).convert('RGB')
    res = lm.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.asarray(im)))
    if not res.face_landmarks:
        raise SystemExit(f'لم يُكشف وجه في {path}')
    f = res.face_landmarks[0]
    pts = np.array([[p.x * im.size[0], p.y * im.size[1]] for p in f])
    lm.close()  # إغلاق صريح: تجنّب خطأ الإنهاء في mediapipe عند الخروج
    return pts, im


class TPS:
    """تشويه لوحي رقيق ثنائي الأبعاد: src (n×2) → dst (n×2)."""

    def __init__(self, src, dst, reg=1e-3):
        n = len(src)
        K = self._U(np.linalg.norm(src[:, None, :] - src[None, :, :], axis=2))
        K += np.eye(n) * reg
        Pm = np.hstack([np.ones((n, 1)), src])
        L = np.zeros((n + 3, n + 3))
        L[:n, :n] = K
        L[:n, n:] = Pm
        L[n:, :n] = Pm.T
        Y = np.zeros((n + 3, 2))
        Y[:n] = dst
        self.w = np.linalg.solve(L, Y)
        self.src = src

    @staticmethod
    def _U(r):
        r2 = r * r
        with np.errstate(divide='ignore', invalid='ignore'):
            u = r2 * np.log(r2)
        u[~np.isfinite(u)] = 0
        return u

    def __call__(self, pts):
        n = len(self.src)
        out = np.empty((len(pts), 2))
        for s in range(0, len(pts), 20000):
            chunk = pts[s:s + 20000]
            K = self._U(np.linalg.norm(chunk[:, None, :] - self.src[None, :, :], axis=2))
            Pm = np.hstack([np.ones((len(chunk), 1)), chunk])
            out[s:s + 20000] = K @ self.w[:n] + Pm @ self.w[n:]
        return out


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--mhdata', required=True)
    ap.add_argument('--photo', required=True)
    ap.add_argument('--front', required=True)
    ap.add_argument('--model', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    C = CHARACTER

    # --- الشبكة بالإحداثيات نفسها التي بُني بها الرأس ---
    obj = load_obj(os.path.join(a.mhdata, '3dobjs', 'base.obj'))
    vg = load_vgroups(os.path.join(a.mhdata, 'mesh_metadata', 'basemesh_vertex_groups.json'))
    V = apply_targets(obj['V'], macro_targets(a.mhdata, **C['macro']) + [
        (os.path.join(a.mhdata, 'targets', p + '.target.gz'), w) for p, w in C['details']])
    VB = to_blender(V)
    VB[:, 2] -= joint_center(VB, vg, 'joint-ground')[2]
    VT, faces = obj['VT'], obj['faces']
    cam = json.load(open(os.path.join(a.front, 'front-cam.json'), encoding='utf8'))
    cx, cy, cz = cam['center']
    scale, size = cam['scale'], cam['size']

    def to_px(P):
        return np.stack([(P[:, 0] - cx) / scale * size + size / 2, size / 2 - (P[:, 2] - cz) / scale * size], axis=1)

    # --- المعالم والتشويه ---
    P_photo, photo = landmarks(a.model, a.photo)
    P_render, _ = landmarks(a.model, os.path.join(a.front, 'front.png'))
    tps = TPS(P_render, P_photo, reg=5.0)
    photo_a = np.asarray(photo).astype(np.float32)
    PW, PH = photo.size

    # منطقة الوجه في الصورة: بيضوي الوجه مقصوصًا من الأعلى عند الحاجبين (الجبهة
    # مغطّاة بالغترة في الصورة فلا تُؤخذ منها)، مع تدرّج ناعم عند الحافّة
    oval = Image.new('L', (PW, PH), 0)
    ImageDraw.Draw(oval).polygon([tuple(P_photo[i]) for i in OVAL], fill=255)
    brow_y = float(np.mean(P_photo[BROW_TOP][:, 1])) - 10
    oval_a = np.asarray(oval).astype(np.float32) / 255
    yy = np.arange(PH)[:, None]
    oval_a = oval_a * smoothstep(brow_y - 26, brow_y + 6, np.broadcast_to(yy, (PH, PW)).astype(np.float32))
    oval_soft = np.asarray(Image.fromarray((oval_a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(14))).astype(np.float32) / 255
    oval_soft = np.minimum(oval_soft, oval_a)  # التدرّج إلى الداخل فقط

    # --- رؤوس الرأس ووجوهه ---
    head_z = joint_center(VB, vg, 'joint-l-clavicle')[2]
    head_v = np.zeros(len(VB), bool)
    head_v[:BODY_VERTS] = VB[:BODY_VERTS, 2] > head_z
    hfaces = [(vi, ti) for g, vi, ti in faces if g == 'body' and all(head_v[v] for v in vi) and -1 not in ti]
    # معدّل الرؤوس للاتجاه
    nrm = np.zeros_like(VB)
    for vi, _ in hfaces:
        p = VB[vi]
        n = np.cross(p[1] - p[0], p[2] - p[0]) + np.cross(p[2] - p[0], p[3] - p[0]) if len(vi) == 4 else np.cross(p[1] - p[0], p[2] - p[0])
        for v in vi:
            nrm[v] += n
    l = np.linalg.norm(nrm, axis=1)
    l[l == 0] = 1
    nrm /= l[:, None]
    FRONT = np.array([0, -1.0, 0])

    # --- إسقاط لكل تكسل ---
    color = np.zeros((W, W, 3), np.float32)
    weight = np.zeros((W, W), np.float32)
    px_all = to_px(VB)
    for vi, ti in hfaces:
        tris = [(0, 1, 2), (0, 2, 3)] if len(vi) == 4 else [(0, 1, 2)]
        for tri in tris:
            idx = [vi[k] for k in tri]
            uv = np.array([VT[ti[k]] for k in tri]) * W
            uv[:, 1] = W - uv[:, 1]
            x0, y0 = np.floor(uv.min(0)).astype(int)
            x1, y1 = np.ceil(uv.max(0)).astype(int)
            if x1 <= x0 or y1 <= y0:
                continue
            xs, ys = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
            pts = np.stack([xs.ravel() + 0.5, ys.ravel() + 0.5], 1)
            # إحداثيات مركزية
            T = np.array([[uv[0, 0] - uv[2, 0], uv[1, 0] - uv[2, 0]], [uv[0, 1] - uv[2, 1], uv[1, 1] - uv[2, 1]]])
            det = np.linalg.det(T)
            if abs(det) < 1e-9:
                continue
            Ti = np.linalg.inv(T)
            lam = (pts - uv[2]) @ Ti.T
            l3 = 1 - lam.sum(1)
            inside = (lam[:, 0] >= -0.002) & (lam[:, 1] >= -0.002) & (l3 >= -0.002)
            if not inside.any():
                continue
            b = np.hstack([lam[inside], l3[inside, None]])
            pos3 = b @ VB[idx]
            n3 = b @ nrm[idx]
            facing = (n3 @ FRONT) / (np.linalg.norm(n3, axis=1) + 1e-9)
            rp = to_px(pos3)
            pp = tps(rp)
            ix = np.clip(pp[:, 0], 0, PW - 1.001)
            iy = np.clip(pp[:, 1], 0, PH - 1.001)
            x_i, y_i = ix.astype(int), iy.astype(int)
            fx, fy = (ix - x_i)[:, None], (iy - y_i)[:, None]
            c = (photo_a[y_i, x_i] * (1 - fx) * (1 - fy) + photo_a[y_i, x_i + 1] * fx * (1 - fy)
                 + photo_a[y_i + 1, x_i] * (1 - fx) * fy + photo_a[y_i + 1, x_i + 1] * fx * fy)
            inb = (pp[:, 0] > 1) & (pp[:, 0] < PW - 2) & (pp[:, 1] > 1) & (pp[:, 1] < PH - 2)
            wgt = smoothstep(0.08, 0.5, facing) * oval_soft[y_i, x_i] * inb
            xi = xs.ravel()[inside]
            yi = ys.ravel()[inside]
            ok = (xi >= 0) & (xi < W) & (yi >= 0) & (yi < W)
            color[yi[ok], xi[ok]] = c[ok]
            weight[yi[ok], xi[ok]] = wgt[ok]

    # --- التركيب على النسيج المولَّد ---
    skin = np.asarray(Image.open(os.path.join(a.out, 'skin.jpg')).convert('RGB')).astype(np.float32)
    # ملاءمة الإضاءة: الصورة المرجعية مضاءة من الأمام؛ نطابق سطوع المنطقة
    # المسقطة مع سطوع النسيج المولَّد عند حافّة المزج حتى لا تظهر درزة
    edge = (weight > 0.05) & (weight < 0.6)
    if edge.sum() > 100:
        ratio = (skin[edge].mean(0) + 1) / (color[edge].mean(0) + 1)
        ratio = np.clip(ratio, 0.75, 1.35)
        color = color * ratio[None, None, :] * 1.05
    w3 = weight[..., None]
    out = skin * (1 - w3) + np.clip(color, 0, 255) * w3
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(os.path.join(a.out, 'skin.jpg'), quality=90, optimize=True)
    # معاينة للمراجعة
    Image.fromarray((weight * 255).astype(np.uint8)).resize((512, 512)).save(os.path.join(a.front, 'proj-weight.png'))
    print('✅ face projected; covered texels', int((weight > 0.5).sum()), 'edge ratio', np.round(ratio, 3) if edge.sum() > 100 else None)


if __name__ == '__main__':
    main()

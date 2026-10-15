#!/usr/bin/env python3
# ---------------------------------------------------------------------------
# بنك الحركات: يستخلص الهيكل العظمي (الجسم + اليدان) من مقاطع إشارات القاموس
# المحلية بنموذج MediaPipe Holistic، ويحفظ لكل إشارة ملف JSON صغيرًا يعيد
# الأفاتار الموحّد أداءه في المتصفّح (SignSkeleton) بدل عرض فيديو المصدر.
#
#   python3 scripts/extract-poses.py --model /path/holistic_landmarker.task \
#       [--only words/health] [--fps 15] [--force] [--hand-model hand_landmarker.task]
#
#   --hand-model: «إنقاذ اليد» للمصادر الصغيرة (صور متحرّكة 180×135): حين يرى Holistic
#   المعصم ولا يرى أصابعه، يُقصّ مربّع حول المعصم ويُكبَّر ويُمرَّر إلى كاشف اليد
#   المتخصّص، ثم تُعاد المعالم إلى إحداثيات الإطار. اليد تُنسب إلى المعصم الذي قُصّ حوله.
#
# المخرج: public/sign/poses/<مسار المقطع بلا امتداد>.json
#   { "v":3, "fps":15, "ar":1 (عرض/ارتفاع), "src":"words/health/karsl-148.mp4", "fk":[أسماء تعابير الوجه],
#     "frames":[ { "p":[[x,y,z,vis]...25], "l":[[x,y,z]...21]|null, "r":[[x,y,z]...21]|null,
#                  "L"/"R":[[x,y,z]...21]|null (اليدان بالمتر), "h":[[x,y,z]...5]|null, "f":[قيم التعابير]|null } ... ] }
#   x,y مُطبَّعة إلى [0,1] نسبةً إلى الإطار، وz عمق نسبي بمقياس x (MediaPipe)،
#   مقرّبة إلى 3 منازل. p: معالم الجزء العلوي (0–24) فقط.
#   h: خمس نقاط من الوجه لاتجاه الرأس (طرف الأنف، العينان، الذقن، الجبهة).
#   f: تعابير الوجه (blendshapes) — العلامات غير اليدوية في لغة الإشارة
#   (الحاجبان للاستفهام، الفم، العينان) يؤدّيها الأفاتار ثلاثي الأبعاد.
#
# ملاحظة صدق: الهيكل المستخلص آليًّا قد يفقد تفاصيل الأصابع في الإطارات السريعة؛
# لذلك يبقى مقطع المصدر هو المرجع، والأفاتار خيار عرض موحّد.
# ---------------------------------------------------------------------------
import argparse, json, os, sys, glob
import cv2
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SIGN_DIR = os.path.join(ROOT, 'public', 'sign')
OUT_DIR = os.path.join(SIGN_DIR, 'poses')


# تعابير الوجه المحفوظة (من 52 تعبيرًا في MediaPipe) — ما يلزم العلامات غير اليدوية.
FACE_KEYS = [
    'browInnerUp', 'browDownLeft', 'browDownRight', 'browOuterUpLeft', 'browOuterUpRight',
    'eyeBlinkLeft', 'eyeBlinkRight', 'eyeWideLeft', 'eyeWideRight', 'eyeSquintLeft', 'eyeSquintRight',
    'jawOpen', 'mouthSmileLeft', 'mouthSmileRight', 'mouthFrownLeft', 'mouthFrownRight',
    'mouthPucker', 'mouthFunnel', 'mouthStretchLeft', 'mouthStretchRight', 'mouthPressLeft',
    'mouthPressRight', 'mouthRollLower', 'cheekPuff', 'noseSneerLeft', 'noseSneerRight',
]
# طرف الأنف، زاويتا العينين الخارجيتان، الذقن، أعلى الجبهة (Face Mesh 468)
HEAD_IDX = [1, 33, 263, 152, 10]


def landmarks_to_list(lms, with_vis=False, nd=3, idx=None):
    if not lms:
        return None
    if idx is not None:
        lms = [lms[i] for i in idx]
    out = []
    for lm in lms:
        row = [round(lm.x, nd), round(lm.y, nd), round(lm.z, nd)]
        if with_vis:
            row.append(round(getattr(lm, 'visibility', 1.0) or 0.0, 2))
        out.append(row)
    return out


class _P:  # نقطة بواجهة معالم MediaPipe (x, y, z)
    __slots__ = ('x', 'y', 'z')

    def __init__(self, x, y, z):
        self.x, self.y, self.z = x, y, z


def rescue_hand(rgb, pose, wi, ei, hands):
    """يد المعصم wi (15 يسار، 16 يمين) من قصّ مكبَّر حوله، أو (None, None).
    يجرّب ثلاثة أحجام للقصّ: اليد الضبابية تُكشف أحيانًا في قصّ أوسع (سياق أكثر) أو أضيق."""
    for sc in (1.0, 1.5, 0.8):
        img, world = _rescue_at(rgb, pose, wi, ei, hands, sc)
        if img:
            return img, world
    return None, None


def _rescue_at(rgb, pose, wi, ei, hands, sc):
    H, W = rgb.shape[:2]
    wr, el = pose[wi], pose[ei]
    if (getattr(wr, 'visibility', 1.0) or 0) < 0.3:
        return None, None
    wx, wy, ex, ey = wr.x * W, wr.y * H, el.x * W, el.y * H
    fore = max(((wx - ex) ** 2 + (wy - ey) ** 2) ** 0.5, 0.06 * W)
    # الكفّ امتداد الساعد بعد المعصم: مركز القصّ أبعد قليلًا من المعصم
    cx, cy = wx + 0.45 * (wx - ex), wy + 0.45 * (wy - ey)
    half = 1.15 * sc * fore
    x0, y0 = int(round(cx - half)), int(round(cy - half))
    size = int(round(2 * half))
    pad = cv2.copyMakeBorder(rgb, size, size, size, size, cv2.BORDER_REPLICATE)
    crop = pad[y0 + size:y0 + 2 * size, x0 + size:x0 + 2 * size]
    if crop.size == 0:
        return None, None
    crop = cv2.resize(crop, (256, 256), interpolation=cv2.INTER_CUBIC)
    res = hands.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=crop.copy()))
    best, bd = None, 0.6 * fore
    for k, lms in enumerate(res.hand_landmarks or []):
        hx, hy = x0 + lms[0].x * size, y0 + lms[0].y * size
        d = ((hx - wx) ** 2 + (hy - wy) ** 2) ** 0.5
        if d < bd:
            best, bd = k, d
    if best is None:
        return None, None
    img = [_P((x0 + q.x * size) / W, (y0 + q.y * size) / H, q.z * size / W) for q in res.hand_landmarks[best]]
    world = res.hand_world_landmarks[best] if res.hand_world_landmarks else None
    return img, world


# الطابع الزمني يجب أن يتزايد عبر كل المقاطع في جلسة الكاشف الواحدة (وضع VIDEO).
_ts_base = 0


def extract(path, landmarker, fps_target, hands=None):
    global _ts_base
    cap = cv2.VideoCapture(path)
    src_fps = cap.get(cv2.CAP_PROP_FPS) or 30
    w, h = cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 1, cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 1
    step = max(1, int(round(src_fps / fps_target)))
    frames = []
    i = 0
    ts = _ts_base
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if i % step == 0:
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            # طابع زمني متزايد تمامًا مهما كانت بيانات fps في الملف
            ts = max(ts + 1, _ts_base + int(i * 1000 / src_fps))
            res = landmarker.detect_for_video(img, ts)
            # في Holistic النتائج قوائم معالم مباشرة (لا قائمة أشخاص)
            pose = res.pose_landmarks or None
            lh = res.left_hand_landmarks or None
            rh = res.right_hand_landmarks or None
            lw = getattr(res, 'left_hand_world_landmarks', None) or None
            rw = getattr(res, 'right_hand_world_landmarks', None) or None
            # تصحيح تبديل اليدين: كل يد تُنسب إلى أقرب معصم في هيكل الجسم
            if pose and (lh or rh):
                def near(h):
                    d15 = (h[0].x - pose[15].x) ** 2 + (h[0].y - pose[15].y) ** 2
                    d16 = (h[0].x - pose[16].x) ** 2 + (h[0].y - pose[16].y) ** 2
                    return 'l' if d15 <= d16 else 'r'
                sl = near(lh) if lh else None
                sr = near(rh) if rh else None
                if (sl == 'r' and sr != 'r') or (sr == 'l' and sl != 'l'):
                    lh, rh, lw, rw = rh, lh, rw, lw
            if hands is not None and pose:
                if not lh:
                    lh, lw = rescue_hand(rgb, pose, 15, 13, hands)
                if not rh:
                    rh, rw = rescue_hand(rgb, pose, 16, 14, hands)
            face = res.face_landmarks or None
            bs = None
            if res.face_blendshapes:
                cats = {c.category_name: c.score for c in res.face_blendshapes}
                bs = [round(cats.get(k, 0.0), 2) for k in FACE_KEYS]
            frames.append({
                'p': landmarks_to_list(pose[:25] if pose else None, with_vis=True),
                'l': landmarks_to_list(lh),
                'r': landmarks_to_list(rh),
                # معالم اليد ثلاثية الأبعاد بالمتر (دقيقة العمق — أساس أشكال الأصابع)
                'L': landmarks_to_list(lw, nd=4) if lw else None,
                'R': landmarks_to_list(rw, nd=4) if rw else None,
                'h': landmarks_to_list(face, idx=HEAD_IDX) if face else None,
                'f': bs,
            })
        i += 1
    cap.release()
    _ts_base = ts + 1000
    return frames, src_fps / step, round(w / h, 3)


def _advance_ts(delta=5000):
    """بعد فشل مقطع: نقفز بالطابع الزمني حتى لا يفشل ما بعده."""
    global _ts_base
    _ts_base += delta


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', required=True, help='holistic_landmarker.task')
    ap.add_argument('--only', default='', help='مسار فرعي داخل public/sign (مثل words/health)')
    ap.add_argument('--fps', type=float, default=15)
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--hand-model', default='', help='hand_landmarker.task لإنقاذ اليد في المصادر الصغيرة')
    a = ap.parse_args()

    base = mp_python.BaseOptions(model_asset_path=a.model)
    opts = vision.HolisticLandmarkerOptions(base_options=base, running_mode=vision.RunningMode.VIDEO,
                                         output_face_blendshapes=True)
    clips = sorted(glob.glob(os.path.join(SIGN_DIR, a.only or '', '**', '*.mp4'), recursive=True))
    done = skipped = failed = 0
    # الكاشف يتعطّل بعد أي خطأ داخلي في الرسم البياني؛ نعيد إنشاءه عند الفشل.
    landmarker = vision.HolisticLandmarker.create_from_options(opts)
    hands = None
    if a.hand_model:
        hands = vision.HandLandmarker.create_from_options(vision.HandLandmarkerOptions(
            base_options=mp_python.BaseOptions(model_asset_path=a.hand_model), num_hands=2,
            min_hand_detection_confidence=0.3, min_hand_presence_confidence=0.3))
    try:
        for clip in clips:
            rel = os.path.relpath(clip, SIGN_DIR)
            out = os.path.join(OUT_DIR, os.path.splitext(rel)[0] + '.json')
            if os.path.exists(out) and not a.force:
                skipped += 1
                continue
            try:
                frames, fps, ar = extract(clip, landmarker, a.fps, hands)
                detected = sum(1 for f in frames if f['p'])
                if not frames or detected < len(frames) * 0.5:
                    print(f'⚠️ {rel}: كُشف الجسم في {detected}/{len(frames)} إطارًا فقط — تُخطّى', file=sys.stderr)
                    failed += 1
                    continue
                os.makedirs(os.path.dirname(out), exist_ok=True)
                with open(out, 'w', encoding='utf8') as f:
                    json.dump({'v': 3, 'fps': round(fps, 2), 'ar': ar, 'src': rel.replace(os.sep, '/'), 'fk': FACE_KEYS,
                               'frames': frames},
                              f, ensure_ascii=False, separators=(',', ':'))
                done += 1
                print(f'{rel}: {len(frames)} إطارًا، أيدٍ في {sum(1 for f in frames if f["l"] or f["r"])}')
            except Exception as e:  # noqa: BLE001
                print(f'❌ {rel}: {str(e).strip()[:120]}', file=sys.stderr)
                failed += 1
                _advance_ts()
                try:
                    landmarker.close()
                except Exception:  # noqa: BLE001
                    pass
                landmarker = vision.HolisticLandmarker.create_from_options(opts)
    finally:
        landmarker.close()
        if hands is not None:
            hands.close()
    print(f'\n✅ بنك الحركات: {done} جديد، {skipped} موجود، {failed} فشل. المخرج: {OUT_DIR}')


if __name__ == '__main__':
    main()

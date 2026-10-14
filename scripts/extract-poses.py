#!/usr/bin/env python3
# ---------------------------------------------------------------------------
# بنك الحركات: يستخلص الهيكل العظمي (الجسم + اليدان) من مقاطع إشارات القاموس
# المحلية بنموذج MediaPipe Holistic، ويحفظ لكل إشارة ملف JSON صغيرًا يعيد
# الأفاتار الموحّد أداءه في المتصفّح (SignSkeleton) بدل عرض فيديو المصدر.
#
#   python3 scripts/extract-poses.py --model /path/holistic_landmarker.task \
#       [--only words/health] [--fps 15] [--force]
#
# المخرج: public/sign/poses/<مسار المقطع بلا امتداد>.json
#   { "v":1, "fps":15, "w":1, "h":1, "src":"words/health/karsl-148.mp4",
#     "frames":[ { "p":[[x,y,vis]...33], "l":[[x,y]...21]|null, "r":[[x,y]...21]|null } ... ] }
#   الإحداثيات مُطبَّعة إلى [0,1] نسبةً إلى الإطار، ومقرّبة إلى 3 منازل.
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


def landmarks_to_list(lms, with_vis=False, nd=3):
    if not lms:
        return None
    out = []
    for lm in lms:
        row = [round(lm.x, nd), round(lm.y, nd)]
        if with_vis:
            row.append(round(getattr(lm, 'visibility', 1.0) or 0.0, 2))
        out.append(row)
    return out


# الطابع الزمني يجب أن يتزايد عبر كل المقاطع في جلسة الكاشف الواحدة (وضع VIDEO).
_ts_base = 0


def extract(path, landmarker, fps_target):
    global _ts_base
    cap = cv2.VideoCapture(path)
    src_fps = cap.get(cv2.CAP_PROP_FPS) or 30
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
            frames.append({
                'p': landmarks_to_list(pose, with_vis=True),
                'l': landmarks_to_list(lh),
                'r': landmarks_to_list(rh),
            })
        i += 1
    cap.release()
    _ts_base = ts + 1000
    return frames, src_fps / step


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
    a = ap.parse_args()

    base = mp_python.BaseOptions(model_asset_path=a.model)
    opts = vision.HolisticLandmarkerOptions(base_options=base, running_mode=vision.RunningMode.VIDEO)
    clips = sorted(glob.glob(os.path.join(SIGN_DIR, a.only or '', '**', '*.mp4'), recursive=True))
    done = skipped = failed = 0
    # الكاشف يتعطّل بعد أي خطأ داخلي في الرسم البياني؛ نعيد إنشاءه عند الفشل.
    landmarker = vision.HolisticLandmarker.create_from_options(opts)
    try:
        for clip in clips:
            rel = os.path.relpath(clip, SIGN_DIR)
            out = os.path.join(OUT_DIR, os.path.splitext(rel)[0] + '.json')
            if os.path.exists(out) and not a.force:
                skipped += 1
                continue
            try:
                frames, fps = extract(clip, landmarker, a.fps)
                detected = sum(1 for f in frames if f['p'])
                if not frames or detected < len(frames) * 0.5:
                    print(f'⚠️ {rel}: كُشف الجسم في {detected}/{len(frames)} إطارًا فقط — تُخطّى', file=sys.stderr)
                    failed += 1
                    continue
                os.makedirs(os.path.dirname(out), exist_ok=True)
                with open(out, 'w', encoding='utf8') as f:
                    json.dump({'v': 1, 'fps': round(fps, 2), 'src': rel.replace(os.sep, '/'), 'frames': frames},
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
    print(f'\n✅ بنك الحركات: {done} جديد، {skipped} موجود، {failed} فشل. المخرج: {OUT_DIR}')


if __name__ == '__main__':
    main()

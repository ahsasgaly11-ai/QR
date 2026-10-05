#!/usr/bin/env python3
"""تدريب كاشف الكرة (YOLO11n) وتصديره إلى ONNX للمتصفح.

على Google Colab أو حاسوب فيه Python:
    pip install ultralytics onnx onnxslim
    python3 prepare_dataset.py qurs-samples-*.jsonl --out dataset
    python3 train.py --data dataset/data.yaml --epochs 80 --imgsz 320

الناتج: models/ball.onnx — انسخه إلى مجلد التطبيق models/ وفعّل BALL_MODEL_URL في config.js.
"""
import argparse, shutil, os
from ultralytics import YOLO

ap = argparse.ArgumentParser()
ap.add_argument('--data', default='dataset/data.yaml'); ap.add_argument('--epochs', type=int, default=80); ap.add_argument('--imgsz', type=int, default=320)
ap.add_argument('--model', default='yolo11n.pt'); ap.add_argument('--out', default='models/ball.onnx')
a = ap.parse_args()
m = YOLO(a.model)
m.train(data=a.data, epochs=a.epochs, imgsz=a.imgsz, batch=32, patience=20, degrees=10, scale=0.3, fliplr=0.5, hsv_v=0.4, mosaic=1.0, project='runs', name='ball', exist_ok=True)
best = YOLO('runs/ball/weights/best.pt')
metrics = best.val(data=a.data, imgsz=a.imgsz)
print('mAP50:', metrics.box.map50, '| mAP50-95:', metrics.box.map)
path = best.export(format='onnx', imgsz=a.imgsz, opset=17, simplify=True, dynamic=False, half=False)
os.makedirs(os.path.dirname(a.out), exist_ok=True); shutil.copy(path, a.out)
print('تم التصدير إلى', a.out)

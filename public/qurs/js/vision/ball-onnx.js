// كاشف الكرة بالتعلّم الآلي (ONNX Runtime Web + نموذج YOLO مدرَّب على صور صفّك).
// يُفعَّل عندما يوجد BALL_MODEL_URL في config.js وملفات onnxruntime-web في vendor/ort/.
// يعمل في الخيط الرئيسي (ort يدير عمّاله بنفسه) ويعيد مربعات الكرات في إحداثيات الفيديو؛ تُحوَّل إلى إحداثيات القرص بالهوموغرافي.
// ملاحظة: لم يُجرَّب في بيئة البناء لعدم توفر نموذج مدرَّب بعد؛ راجع training/README_AR.md.
export class OnnxBallDetector {
  constructor({ modelUrl, ortUrl, size = 320, conf = 0.45, iou = 0.5 }) { Object.assign(this, { modelUrl, ortUrl, size, conf, iou, session: null, ready: false, busy: false, cv: document.createElement('canvas') }); this.cv.width = size; this.cv.height = size; this.ctx = this.cv.getContext('2d', { willReadFrequently: true }); }
  async load() {
    if (!window.ort) { await new Promise((res, rej) => { const s = document.createElement('script'); s.src = this.ortUrl; s.onload = res; s.onerror = rej; document.head.append(s); }); }
    const ort = window.ort; ort.env.wasm.wasmPaths = this.ortUrl.replace(/[^/]*$/, '');
    const providers = navigator.gpu ? ['webgpu', 'wasm'] : ['wasm'];
    this.session = await ort.InferenceSession.create(this.modelUrl, { executionProviders: providers, graphOptimizationLevel: 'all' });
    this.inputName = this.session.inputNames[0]; this.ready = true; return this;
  }
  // يعيد [{x,y,w,h,score}] بإحداثيات الفيديو
  async detect(videoEl, vw, vh) {
    if (!this.ready || this.busy) return null; this.busy = true;
    try {
      const S = this.size; this.ctx.drawImage(videoEl, 0, 0, S, S);
      const d = this.ctx.getImageData(0, 0, S, S).data, inp = new Float32Array(3 * S * S);
      for (let i = 0; i < S * S; i++) { inp[i] = d[i * 4] / 255; inp[S * S + i] = d[i * 4 + 1] / 255; inp[2 * S * S + i] = d[i * 4 + 2] / 255; }
      const out = await this.session.run({ [this.inputName]: new window.ort.Tensor('float32', inp, [1, 3, S, S]) });
      const o = out[this.session.outputNames[0]]; // YOLOv8/11: [1, 4+nc, N]
      const [, C, N] = o.dims, data = o.data, boxes = [];
      for (let n = 0; n < N; n++) { let best = 0; for (let c = 4; c < C; c++) best = Math.max(best, data[c * N + n]); if (best < this.conf) continue;
        boxes.push({ x: (data[n] / S) * vw, y: (data[N + n] / S) * vh, w: (data[2 * N + n] / S) * vw, h: (data[3 * N + n] / S) * vh, score: best }); }
      boxes.sort((a, b) => b.score - a.score); const keep = [];
      for (const b of boxes) { if (keep.every((k) => iou(k, b) < this.iou)) keep.push(b); }
      return keep;
    } finally { this.busy = false; }
  }
}
function iou(a, b) { const x0 = Math.max(a.x - a.w / 2, b.x - b.w / 2), y0 = Math.max(a.y - a.h / 2, b.y - b.h / 2), x1 = Math.min(a.x + a.w / 2, b.x + b.w / 2), y1 = Math.min(a.y + a.h / 2, b.y + b.h / 2);
  const inter = Math.max(0, x1 - x0) * Math.max(0, y1 - y0); return inter / (a.w * a.h + b.w * b.h - inter); }

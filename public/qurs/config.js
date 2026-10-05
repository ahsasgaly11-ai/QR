// إعداد اختياري للمزامنة السحابية. اتركه فارغًا للعمل المحلي فقط.
// للتفعيل: ضع إعداد مشروع Firebase هنا (من Project settings → Your apps → Web app)، وأضف schoolId لتمييز مدرستك.
export const FIREBASE_CONFIG = null;
// مثال:
// export const FIREBASE_CONFIG = { apiKey: '...', authDomain: '...firebaseapp.com', projectId: '...', appId: '...', schoolId: 'school-01' };

// مسار نموذج كشف الكرة المدرَّب (ONNX). اتركه null لاستخدام الكاشف الكلاسيكي حتى تدرّب نموذجك (راجع training/README_AR.md).
export const BALL_MODEL_URL = null; // مثال: 'models/ball.onnx'
export const ORT_URL = 'vendor/ort/ort.min.js'; // ضع ملفات onnxruntime-web هنا عند تفعيل النموذج

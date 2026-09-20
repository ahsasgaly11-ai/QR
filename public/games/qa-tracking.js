/*
 * عقد تتبّع أنشطة «منصة مناهج قطر التفاعلية»
 * ---------------------------------------------------------------------------
 * الصقْ هذا المقتطف داخل <script> في أي لعبة/نشاط HTML لتبثّ نتائج الطالب
 * إلى المنصّة (تعمل بصمت وبلا ضرر إذا شُغّلت اللعبة خارج المنصّة).
 *
 * الاستخدام داخل اللعبة — عند نفس نقطة "صح/خطأ" الموجودة أصلًا:
 *     QA.answer(true,  'q3');   // إجابة صحيحة على السؤال q3
 *     QA.answer(false, 'q4');   // إجابة خاطئة
 *     QA.progress(2, 10);       // وصل للخطوة 2 من 10 (اختياري)
 *     QA.result(8, 10);         // النتيجة النهائية: 8 من 10
 *
 * الملاحظة الوحيدة: نادِ QA.result مرّة واحدة عند إتمام النشاط.
 */
(function () {
  var SRC = 'qa-activity';
  function send(msg) {
    try {
      if (window.parent && window.parent !== window) {
        msg.source = SRC;
        window.parent.postMessage(msg, '*');
      }
    } catch (e) {
      /* اللعبة تعمل خارج المنصّة — تجاهل */
    }
  }
  window.QA = {
    ready: function () {
      send({ type: 'ready' });
    },
    answer: function (correct, qid) {
      send({ type: 'answer', correct: !!correct, qid: qid });
    },
    progress: function (step, steps) {
      send({ type: 'progress', step: step, steps: steps });
    },
    result: function (score, total) {
      send({ type: 'result', score: score, total: total });
    },
  };
  window.QA.ready();
})();

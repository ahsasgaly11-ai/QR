// ---------------------------------------------------------------------------
// مراقِب الألعاب (Game Observer)
// ---------------------------------------------------------------------------
// يقرأ تقدّم الطالب من الألعاب المرفقة **دون تعديلها**. ألعاب إطار
// qatar-edu-html-games تُشغّل صوت الإجابة عبر دالّتين عامّتين
// (sfxCorrect / sfxWrong). بما أن الـ iframe يعمل بنفس الأصل
// (allow-same-origin)، نحقن هذا السكربت داخل اللعبة بعد تحميلها فيلتفّ
// حول هاتين الدالّتين (وبدائلها الشائعة) ويبثّ حدث answer وفق عقد التتبّع
// (activity-events) — فيلتقطه المشغّل ويحفظ الإتقان.
//
// أسلوب أفضل جهد (best-effort) مُصمَّم لهذا الإطار الموحّد: ما لا يطابق
// الأنماط المعروفة يبقى للعقد الصريح (postMessage) عبر qa-tracking.js.
// ---------------------------------------------------------------------------

/** أسماء الدوالّ العامّة التي تدلّ على إجابة صحيحة في ألعاب الإطار. */
const CORRECT_FNS = ['sfxCorrect', 'playCorrect', 'onCorrect', 'showCorrect'];
/** أسماء الدوالّ العامّة التي تدلّ على إجابة خاطئة. */
const WRONG_FNS = ['sfxWrong', 'playWrong', 'onWrong', 'showWrong'];

/**
 * كود المراقِب المحقون داخل إطار اللعبة. يعمل في سياق اللعبة نفسها،
 * فيصل إلى دوالّها العامّة ويبثّ الأحداث إلى النافذة الأمّ (المشغّل).
 */
export const GAME_OBSERVER_JS = `(function(){
  if (window.__qaObserver) return; window.__qaObserver = 1;
  var SRC='qa-activity';
  var CORRECT=${JSON.stringify(CORRECT_FNS)};
  var WRONG=${JSON.stringify(WRONG_FNS)};
  function emit(m){ try{ m.source=SRC; if(window.parent&&window.parent!==window) window.parent.postMessage(m,'*'); }catch(e){} }
  function wrap(names, correct){
    for (var i=0;i<names.length;i++){
      var n=names[i], f=window[n];
      if (typeof f==='function' && !f.__qaWrapped){
        (function(orig){
          var w=function(){ emit({type:'answer', correct:correct}); return orig.apply(this, arguments); };
          w.__qaWrapped=true;
          try { window[n]=w; } catch(e){}
        })(f);
      }
    }
  }
  function hook(){ wrap(CORRECT,true); wrap(WRONG,false); }
  hook();
  // بعض الألعاب تُعرّف دوالّها بعد التحميل بقليل — أعد الربط عدّة مرّات
  var n=0, t=setInterval(function(){ hook(); if(++n>20) clearInterval(t); }, 250);
  emit({type:'ready'});
})();`;

/**
 * يحقن المراقِب داخل إطار اللعبة المحمّلة. آمن: يتجاهل بصمت إن كان الإطار
 * من أصل مختلف أو مُنع الوصول (تبقى حينها طريقة العقد الصريح).
 */
export function injectGameObserver(iframe: HTMLIFrameElement | null): void {
  if (!iframe) return;
  try {
    const win = iframe.contentWindow as (Window & { __qaObserver?: number }) | null;
    const doc = iframe.contentDocument;
    if (!win || !doc || win.__qaObserver) return;
    const s = doc.createElement('script');
    s.textContent = GAME_OBSERVER_JS;
    (doc.body || doc.documentElement).appendChild(s);
    s.remove();
  } catch {
    /* أصل مختلف أو محظور — يبقى العقد الصريح (qa-tracking.js) هو البديل */
  }
}

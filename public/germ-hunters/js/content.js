// ---------------------------------------------------------------------------
// محتوى «صيّادو الجراثيم» — درس العلوم 3.2: أين توجد الجراثيم؟
// المرجع: كتاب الطالب (النشاط الافتتاحي، والأنشطة ١ و٢ و٣، و«ماذا تعلّمت؟»):
//   • الجراثيم أصغر من أن تُرى بالعين المجرّدة، لكنها تتوهّج تحت ضوء خاص من الأشعة فوق البنفسجية.
//   • يمكن أن توجد على أجسامنا وعلى الأشياء التي لا تبدو متّسخة.
//   • سطح جلدنا خشن، ويسهل على الجراثيم أن تعلق على السطح الخشن أكثر من الناعم.
//   • ننشر الجراثيم عندما نعطس أو نسعل، وعن طريق أيدينا عندما نلمس الأشياء.
// نصائح المنع (منديل، مرفق، غسل اليدين، تنظيف الأسطح) من إرشادات CDC للأطفال (انظر README_AR.md).
//
// الجولة ١ (surface): صنّف الشيء حسب سطحه: خشن أم ناعم.
// الجولة ٢ (spread): صنّف السلوك: ينشر الجراثيم أم يمنع انتشارها.
// model = المجسّم ثلاثي الأبعاد في الحجرة البنفسجية (scene3d.js)، وscene = المشهد القصير بعد الصواب.
// wrong = تلميح لطيف يظهر حين يضع الطالب البطاقة في السلة الخاطئة (يكشف الفهم الخاطئ الشائع).
// ---------------------------------------------------------------------------
export const CONTENT = {
  title: 'صيّادو الجراثيم',
  lead: 'الجراثيم أصغر من أن نراها… لكنها تتوهّج تحت الضوء البنفسجي!',
  /** عدد البطاقات في كل جولة لكل فريق */
  perRound: { surface: 5, spread: 5 },
  /** أقل عدد من كل فئة في الجولة (حتى لا تكون الإجابة واحدة دائمًا) */
  minEach: 2,
  /** بطاقات تظهر في كل جولة دائمًا (أهم فكرة في الدرس) */
  always: ['hand'],
  rounds: [
    {
      id: 'surface',
      name: 'أين تعلق الجراثيم؟',
      ask: 'هل سطحه خشن أم ناعم؟',
      bins: [
        { id: 'rough', name: 'سطح خشن', sub: 'تعلق عليه الجراثيم بسهولة', icon: 'rough' },
        { id: 'smooth', name: 'سطح ناعم', sub: 'تُزال عنه الجراثيم أسهل', icon: 'smooth' },
      ],
    },
    {
      id: 'spread',
      name: 'تنشر أم تمنع؟',
      ask: 'هل هذا ينشر الجراثيم أم يمنع انتشارها؟',
      bins: [
        { id: 'spread', name: 'ينشر الجراثيم', sub: 'ينقلها إلى الأسطح والناس', icon: 'spread' },
        { id: 'stop', name: 'يمنع انتشارها', sub: 'يحمينا ويحمي زملاءنا', icon: 'stop' },
      ],
    },
  ],
  items: [
    // ---------------- الجولة ١: خشن
    {
      id: 'hand', round: 'surface', cat: 'rough', name: 'جلد اليد', emoji: '✋', model: 'hand',
      fact: 'يبدو ناعمًا، لكنه خشن تحت العدسة المكبّرة؛ لذلك تعلق عليه الجراثيم.',
      wrong: 'جلدنا يبدو ناعمًا… لكن تحت العدسة المكبّرة هو خشن!',
    },
    {
      id: 'sponge', round: 'surface', cat: 'rough', name: 'الإسفنجة', emoji: '🧽', model: 'sponge',
      fact: 'فيها ثقوب ونتوءات كثيرة تعلق بها الجراثيم.',
      wrong: 'تحسّسوا الإسفنجة: فيها ثقوب ونتوءات كثيرة!',
    },
    {
      id: 'wool', round: 'surface', cat: 'rough', name: 'كُبّة الصوف', emoji: '🧶', model: 'wool',
      fact: 'خيوطها متشابكة وخشنة، فتعلق بها الجراثيم.',
      wrong: 'انظروا إلى الخيوط المتشابكة… هل هي ملساء؟',
    },
    {
      id: 'rock', round: 'surface', cat: 'rough', name: 'الصخرة', emoji: '🪨', model: 'rock',
      fact: 'سطحها خشن فيه حفر ونتوءات صغيرة.',
      wrong: 'سطح الصخرة فيه حفر ونتوءات…',
    },
    {
      id: 'log', round: 'surface', cat: 'rough', name: 'جذع الشجرة', emoji: '🪵', model: 'log',
      fact: 'لحاؤه خشن مليء بالشقوق.',
      wrong: 'لحاء الشجرة مليء بالشقوق…',
    },
    {
      id: 'ball', round: 'surface', cat: 'rough', name: 'كرة السلة', emoji: '🏀', model: 'ball',
      fact: 'سطحها خشن بنتوءات صغيرة تساعدنا على الإمساك بها.',
      wrong: 'تحسّسوا كرة السلة: عليها نتوءات صغيرة!',
    },
    // ---------------- الجولة ١: ناعم
    {
      id: 'window', round: 'surface', cat: 'smooth', name: 'زجاج النافذة', emoji: '🪟', model: 'window',
      fact: 'سطحه أملس، فتُزال عنه الجراثيم بسهولة… لكنها قد توجد عليه!',
      wrong: 'مرّروا أصابعكم على الزجاج: هل تشعرون بنتوءات؟',
    },
    {
      id: 'mirror', round: 'surface', cat: 'smooth', name: 'المرآة', emoji: '🪞', model: 'mirror',
      fact: 'سطحها أملس لامع، ومع ذلك قد توجد عليه جراثيم لا نراها.',
      wrong: 'المرآة ملساء لامعة…',
    },
    {
      id: 'plate', round: 'surface', cat: 'smooth', name: 'الصحن', emoji: '🍽️', model: 'plate',
      fact: 'سطحه ناعم، ونغسله جيدًا لأن الجراثيم قد تبقى عليه.',
      wrong: 'سطح الصحن أملس…',
    },
    {
      id: 'spoon', round: 'surface', cat: 'smooth', name: 'الملعقة', emoji: '🥄', model: 'spoon',
      fact: 'سطحها معدن أملس، لكن الجراثيم قد تبقى عليها إن لم نغسلها.',
      wrong: 'الملعقة المعدنية ملساء…',
    },
    {
      id: 'apple', round: 'surface', cat: 'smooth', name: 'التفاحة', emoji: '🍎', model: 'apple',
      fact: 'قشرتها ناعمة، لكن اغسلوها قبل الأكل: قد تكون عليها جراثيم!',
      wrong: 'قشرة التفاحة ناعمة لامعة…',
    },
    {
      id: 'balloon', round: 'surface', cat: 'smooth', name: 'البالون', emoji: '🎈', model: 'balloon',
      fact: 'سطحه ناعم أملس، ومع ذلك قد تكون عليه جراثيم.',
      wrong: 'البالون أملس ناعم…',
    },
    // ---------------- الجولة ٢: ينشر
    {
      id: 'sneeze', round: 'spread', cat: 'spread', name: 'العطاس بلا تغطية', emoji: '🤧', scene: 'spray',
      fact: 'يتناثر الرذاذ من الفم ويتساقط على الأسطح القريبة.',
      wrong: 'إلى أين يذهب الرذاذ حين لا نغطّي أفواهنا؟',
    },
    {
      id: 'cough', round: 'spread', cat: 'spread', name: 'السعال في وجه الآخرين', emoji: '😮‍💨', scene: 'spray',
      fact: 'السعال يطلق الجراثيم في الهواء نحو من حولنا.',
      wrong: 'السعال بلا تغطية يطلق الجراثيم نحو زملائنا…',
    },
    {
      id: 'shake', round: 'spread', cat: 'spread', name: 'المصافحة بيد عطستَ فيها', emoji: '🤝', scene: 'shake',
      fact: 'تنتقل الجراثيم من يدك إلى يد زميلك.',
      wrong: 'اليد التي عطستَ فيها عليها جراثيم…',
    },
    {
      id: 'eat', round: 'spread', cat: 'spread', name: 'الأكل بيدين لم تُغسلا', emoji: '🥪', scene: 'food',
      fact: 'تنتقل الجراثيم من يديك إلى طعامك.',
      wrong: 'هل غسلنا أيدينا قبل الأكل؟',
    },
    {
      id: 'tissueLeft', round: 'spread', cat: 'spread', name: 'ترك المنديل المستعمل على الطاولة', emoji: '🧻', scene: 'leave',
      fact: 'تنتقل الجراثيم من المنديل إلى الطاولة وإلى من يلمسها.',
      wrong: 'المنديل المستعمل عليه جراثيم… أين مكانه؟',
    },
    // ---------------- الجولة ٢: يمنع
    {
      id: 'tissue', round: 'spread', cat: 'stop', name: 'العطاس في منديل', emoji: '🤧', scene: 'tissue',
      fact: 'المنديل يوقف الرذاذ، ثم نرميه في السلة.',
      wrong: 'المنديل يوقف الرذاذ قبل أن يتناثر…',
    },
    {
      id: 'elbow', round: 'spread', cat: 'stop', name: 'العطاس في المرفق', emoji: '💪', scene: 'elbow',
      fact: 'المرفق يوقف الرذاذ، فلا يصل إلى أيدينا ولا إلى الأسطح.',
      wrong: 'المرفق يوقف الرذاذ ويبقي أيدينا نظيفة…',
    },
    {
      id: 'wash', round: 'spread', cat: 'stop', name: 'غسل اليدين بالماء والصابون', emoji: '🧼', scene: 'wash',
      fact: 'الماء والصابون يزيلان الجراثيم عن جلدنا الخشن.',
      wrong: 'الصابون يزيل الجراثيم عن أيدينا…',
    },
    {
      id: 'bin', round: 'spread', cat: 'stop', name: 'رمي المنديل في السلة', emoji: '🗑️', scene: 'bin',
      fact: 'المنديل المستعمل مكانه السلة، ثم نغسل أيدينا.',
      wrong: 'المنديل في السلة لا يلمسه أحد…',
    },
    {
      id: 'clean', round: 'spread', cat: 'stop', name: 'تنظيف سطح الطاولة', emoji: '🧴', scene: 'clean',
      fact: 'التنظيف يزيل الجراثيم عن الأسطح التي نلمسها.',
      wrong: 'التنظيف يزيل الجراثيم عن الطاولة…',
    },
  ],
  /** لوحة النصائح في شاشة النتيجة (النشاط ٢: «أقدّم نصيحة لزملائي») */
  tips: [
    { emoji: '🧼', text: 'اغسل يديك بالماء والصابون' },
    { emoji: '💪', text: 'اعطس في مرفقك أو في منديل' },
    { emoji: '🗑️', text: 'ارمِ المنديل في السلة' },
  ],
};

/** اختيار بطاقات الجولة لفريق: minEach من كل فئة على الأقل، والبطاقات الدائمة أولًا. */
export function pickRound(content, roundId, rnd = Math.random) {
  const shuffle = (a) => {
    const r = [...a];
    for (let i = r.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [r[i], r[j]] = [r[j], r[i]];
    }
    return r;
  };
  const round = content.rounds.find((r) => r.id === roundId);
  const n = content.perRound[roundId];
  const pool = content.items.filter((i) => i.round === roundId);
  const chosen = pool.filter((i) => content.always.includes(i.id)).map((i) => i.id);
  for (const bin of round.bins) {
    const have = chosen.filter((id) => pool.find((i) => i.id === id).cat === bin.id).length;
    const extra = shuffle(pool.filter((i) => i.cat === bin.id && !chosen.includes(i.id))).slice(0, Math.max(0, content.minEach - have));
    chosen.push(...extra.map((i) => i.id));
  }
  chosen.push(...shuffle(pool.filter((i) => !chosen.includes(i.id))).slice(0, Math.max(0, n - chosen.length)).map((i) => i.id));
  return shuffle(chosen.slice(0, n));
}

// ---------------------------------------------------------------------------
// محتوى اللعبة — هذا الملف وحده يكفي لصنع لعبة «صنّف» جديدة لأي درس:
// غيّر العنوان والفئات (٢–٤) والعناصر، واترك game.js كما هو.
// المثال: حالات المادة (العلوم).
// ---------------------------------------------------------------------------
export const CONTENT = {
  title: 'صنّف حالات المادة',
  lead: 'التقط البطاقة بيدك وضعها في سلة حالتها — صلب أم سائل أم غاز؟',
  /** الفئات: السلال على السبورة. اللون يميّز السلة وبطاقاتها. */
  categories: [
    { id: 'solid', name: 'صلب', emoji: '🧱', color: '#2f6fd1', fact: 'الصلب له شكل ثابت وحجم ثابت.' },
    { id: 'liquid', name: 'سائل', emoji: '💧', color: '#0e9488', fact: 'السائل حجمه ثابت ويأخذ شكل الإناء الذي يوضع فيه.' },
    { id: 'gas', name: 'غاز', emoji: '💨', color: '#a855f7', fact: 'الغاز لا شكل ثابتًا له ولا حجمًا، وينتشر ليملأ المكان.' },
  ],
  /** العناصر: لكل عنصر فئته الصحيحة. */
  items: [
    { id: 'ice', label: 'مكعب ثلج', emoji: '🧊', category: 'solid' },
    { id: 'stone', label: 'حجر', emoji: '🪨', category: 'solid' },
    { id: 'pencil', label: 'قلم', emoji: '✏️', category: 'solid' },
    { id: 'water', label: 'ماء', emoji: '🚰', category: 'liquid' },
    { id: 'milk', label: 'حليب', emoji: '🥛', category: 'liquid' },
    { id: 'juice', label: 'عصير', emoji: '🧃', category: 'liquid' },
    { id: 'steam', label: 'بخار الماء', emoji: '♨️', category: 'gas' },
    { id: 'balloon', label: 'هواء البالون', emoji: '🎈', category: 'gas' },
    { id: 'smoke', label: 'دخان', emoji: '🌫️', category: 'gas' },
  ],
};

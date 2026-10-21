// ---------------------------------------------------------------------------
// قالب لعبة سبورة: الكاميرا والتتبّع والمعايرة ولوحة المعلم من board-kit،
// واللعبة تقدّم قواعدها (game.js) ومحتواها (content.js) فقط.
// عند النسخ إلى public/<slug>/ غيّر appId فقط (مسارات board-kit مطلقة فتعمل من أي مجلد).
// ---------------------------------------------------------------------------
import { startBoardApp } from '/board-kit/js/app.js';
import { Game } from './game.js';
import { CONTENT } from './content.js';

startBoardApp({
  appId: 'template',
  title: CONTENT.title,
  createGame: (els) => new Game(els, CONTENT),
});

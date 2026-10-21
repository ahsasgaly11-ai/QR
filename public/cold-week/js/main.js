// ---------------------------------------------------------------------------
// «أسبوع الزكام»: الكاميرا والتتبّع والمعايرة ولوحة المعلم من board-kit،
// واللعبة تقدّم قواعدها (game.js) ومحتواها (content.js) ومشهدها (scene3d.js).
// ---------------------------------------------------------------------------
import { startBoardApp } from '/board-kit/js/app.js';
import { Game } from './game.js';
import { CONTENT } from './content.js';

startBoardApp({
  appId: 'cold-week',
  title: CONTENT.title,
  createGame: (els) => new Game(els, CONTENT),
  speechLabel: 'نطق الحل عند الإجابة الصحيحة',
});

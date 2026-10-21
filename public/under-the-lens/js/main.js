// ---------------------------------------------------------------------------
// «عالَمٌ تحت العدسة»: الكاميرا والتتبّع والمعايرة ولوحة المعلم من board-kit،
// واللعبة تقدّم قواعدها (game.js) ومحتواها (content.js) ورسومها (art.js)
// ومشهدها ثلاثي الأبعاد (scene3d.js) ومؤثراتها (fx.js).
// ---------------------------------------------------------------------------
import { startBoardApp } from '/board-kit/js/app.js';
import { Game } from './game.js';
import { CONTENT } from './content.js';

startBoardApp({
  appId: 'under-the-lens',
  title: CONTENT.title,
  createGame: (els) => new Game(els, CONTENT),
});

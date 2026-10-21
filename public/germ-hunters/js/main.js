// ---------------------------------------------------------------------------
// «صيّادو الجراثيم»: الكاميرا والتتبّع والمعايرة ولوحة المعلم من board-kit،
// واللعبة تقدّم قواعدها (game.js) ومحتواها (content.js) ومشهدها ثلاثي الأبعاد
// (scene3d.js + models.js + germs.js) وطبقتها الهادئة (flat.js) ومؤثراتها (fx.js).
// ---------------------------------------------------------------------------
import { startBoardApp } from '/board-kit/js/app.js';
import { Game } from './game.js';
import { CONTENT } from './content.js';

startBoardApp({
  appId: 'germ-hunters',
  title: CONTENT.title,
  createGame: (els) => new Game(els, CONTENT),
});

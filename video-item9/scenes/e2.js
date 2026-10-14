import { W, H, paper, vo, sadu, rr, textIn, chip } from './_lib.js';
import * as THREE from 'three';
MOTION.scene({ id: 'e2',
  setup(ctx) {
    this.st = ctx.stage3D({ fov: 28, camera: [0, 0, 9], env: 'room', tone: 'neutral', samples: 2 });
    const tex = new THREE.Texture(ctx.img('logo')); tex.needsUpdate = true; tex.colorSpace = THREE.SRGBColorSpace;
    const side = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(ctx.P.acc), roughness: .35, clearcoat: .4, envMapIntensity: .5 });
    const front = new THREE.MeshPhysicalMaterial({ map: tex, roughness: .3, clearcoat: .5, envMapIntensity: .4 });
    this.box = new THREE.Mesh(new ctx.RoundedBoxGeometry(2.2, 2.2, .5, 5, .3), [side, side, side, side, front, side]); this.st.add(this.box);
    const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(3, 4, 6); this.st.add(key); this.st.add(new THREE.AmbientLight(0xffffff, .5));
  },
  draw(t, lt, ctx) {
    const { X, P } = ctx; paper(ctx, X);
    const L = i => ctx.wordTime('l25', i), kIn = ctx.at(lt, 0, 1.2, 'expoOut');
    this.box.rotation.set(.1 * Math.sin(lt * .6), (1 - kIn) * 2.4 + Math.sin(lt * .5) * .15, 0); this.box.position.set(0, 1.0, 0); this.box.scale.setScalar(.45 + .25 * kIn);
    this.st.orbit(0, .03, 9); this.st.draw(X);
    vo(ctx, X, t, 'l25', 'مَنَصَّةُ مَناهِجِ قَطَرَ التَّفاعُلِيَّة', 960, 640, { size: 96, color: P.acc, maxWidth: 1700 });
    vo(ctx, X, t, 'l25', 'نَتَعَلَّمُ بِأَيدينا، وَنَكتَشِفُ بِعُقولِنا.', 960, 780, { size: 56, family: 'body', weight: 500, maxWidth: 1860, map: [4, 5, 6, 7] });
    chip(ctx, X, t, { s: L(7).s + .3, x: 960, y: 900, w: 620, h: 90, text: 'qr-xi-seven.vercel.app', size: 40, family: 'num', weight: 600, fill: P.acc, color: '#fbf6ee' });
    textIn(ctx, X, t, 'وزارة التربية والتعليم والتعليم العالي — دولة قطر', 960, 985, L(7).s + .6, { size: 26, color: P.mut });
    // التميمة (المها) تطلّ من الزاوية
    const ok = ctx.at(t, L(4).s, L(4).s + .8, 'expoOut'); if (ok > 0) { const im = ctx.img('oryx'); X.save(); X.globalAlpha = ok; X.translate(150, 1080 - 330 * ok); X.rotate(-.08); X.drawImage(im, -120, 0, 240, 306); X.restore(); }
  } });

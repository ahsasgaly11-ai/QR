import { W, H, paper, vo, sadu, rr } from './_lib.js';
import * as THREE from 'three';
MOTION.scene({ id: 's1',
  setup(ctx) {
    this.st = ctx.stage3D({ fov: 28, camera: [0, 0, 9], env: 'room', tone: 'neutral', samples: 2 });
    const tex = new THREE.Texture(ctx.img('logo')); tex.needsUpdate = true; tex.colorSpace = THREE.SRGBColorSpace;
    const side = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(ctx.P.acc), roughness: .35, clearcoat: .4, envMapIntensity: .5 });
    const front = new THREE.MeshPhysicalMaterial({ map: tex, roughness: .3, clearcoat: .5, envMapIntensity: .4 });
    this.box = new THREE.Mesh(new ctx.RoundedBoxGeometry(2.2, 2.2, .5, 5, .3), [side, side, side, side, front, side]); this.st.add(this.box);
    const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(3, 4, 6); this.st.add(key); this.st.add(new THREE.AmbientLight(0xffffff, .5));
    this.gems = ctx.particles3D({ count: 90, seed: 5, geometry: 'octa', color: ctx.P.hi, spawn: (i, r) => { const a = r() * 6.283, d = r.range(2.2, 4.2); return { p: [Math.cos(a) * d, r.gauss() * 1.1, Math.sin(a) * d - 1], v: [0, r.range(.05, .2), 0], s: r.range(.035, .08), spin: r.range(.5, 2), delay: r.range(0, 1.2), life: 6 }; } }); this.st.add(this.gems.mesh);
  },
  draw(t, lt, ctx) {
    const { X, P } = ctx; paper(ctx, X, { saduK: ctx.at(lt, .2, 1.4, 'expoOut') });
    const kIn = ctx.at(lt, 0, 1.1, 'expoOut');
    this.box.rotation.set(.12 * Math.sin(lt * .6), (1 - kIn) * -2.6 + Math.sin(lt * .5) * .12, 0); this.box.position.set(2.7, .1 + Math.sin(lt * 1.1) * .06, 0); this.box.scale.setScalar(.6 + .4 * kIn);
    this.gems.update(lt); this.st.orbit(0, .05, 9 - .6 * ctx.at(lt, 0, 2, 'expoOut'));
    // ظلّ ناعم تحت الشعار
    const g = X.createRadialGradient(1480, 860, 10, 1480, 860, 260); g.addColorStop(0, `rgba(35,26,23,${.18 * kIn})`); g.addColorStop(1, 'rgba(35,26,23,0)'); X.fillStyle = g; X.save(); X.scale(1, .3); X.fillRect(1100, 2600, 800, 500); X.restore();
    this.st.draw(X);
    vo(ctx, X, t, 'l7', 'مِن هُنا وُلِدَت', 1130, 420, { size: 60, align: 'right', family: 'body', weight: 500, color: P.mut, maxWidth: 1000 });
    vo(ctx, X, t, 'l7', 'مَنَصَّةُ مَناهِجِ قَطَر', 1130, 570, { size: 128, align: 'right', color: P.acc, maxWidth: 1050, map: [3, 4, 5] });
    vo(ctx, X, t, 'l7', 'التَّفاعُلِيَّة', 1130, 720, { size: 128, align: 'right', color: P.ink, maxWidth: 1050, map: [6] });
    const u = ctx.at(t, ctx.wordTime('l7', 6).s + .2, ctx.wordTime('l7', 6).s + .8, 'expoOut'); if (u > 0) { X.fillStyle = P.hi; rr(X, 1130 - 700 * u, 760, 700 * u, 12, 6); X.fill(); }
  } });

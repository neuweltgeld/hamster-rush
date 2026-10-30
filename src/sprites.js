// All pixel art is drawn in code (no PNG files) in a "32-bit era" style:
// larger sprites, hue-shifted multi-tone ramps, lit shading with light dithering,
// selective dark outlines, baked ground shadows, multi-frame animation and dedicated hit frames.
// Sprites are authored at 2x density: the game camera zooms 2x and displays them at SC (0.5) so
// every texel maps to exactly one screen pixel at the native 960x540 canvas.
export const SC = 0.5;

import { buildWorldArt } from './worldart.js';
import { buildHero } from './hero.js';
import { buildEnemyArt } from './enemyart.js';
import { buildIcons } from './iconart.js';
import { buildFx } from './fxart.js';
import { Pix, ramp, clamp, hex2rgb, rgb2hsl, hsl2rgb, hueToward, mix, OUTC, WHITE, BAYER, LIGHT } from './pix.js';
export { Pix, ramp };


const EYE = ramp('#2a1a38'); const MOUTH = ramp('#6a1428'); const PINK = ramp('#f27b92'); const TEETH = ramp('#fff4e0');
const LINE = ramp('#2a1a38');

// ================================================================== HAMSTER (48x48)
export const WF = 8; // frames per walk cycle (all characters)
const CY = (f) => Math.cos((f / WF) * Math.PI * 2), SN = (f) => Math.sin((f / WF) * Math.PI * 2), BOB = (f) => -(1 - Math.cos((f / WF) * Math.PI * 4)) / 2;
const FUR = ramp('#e9a24e'), FUR_D = ramp('#b9682a'), CREAM = ramp('#fbe6bf'), CHEEK = ramp('#f3c98a'), SCARF = ramp('#d9304a');
/** kind: 'w' walk (f 0-7, smooth 8-frame cycle) · 'i' idle (f 0-2, 2 = blink) · 'hit' */
function hamster(kind, f = 0) {
  const p = new Pix(48), hit = kind === 'hit';
  let bob = 0, lf = 44, rf = 44, arm = 0, flap = 1, blink = false;
  if (kind === 'w') { const a = (f / WF) * Math.PI * 2, c = Math.cos(a); bob = -(1 - Math.cos(a * 2)) / 2; lf = 43 + c; rf = 43 - c; arm = -1.5 * c; flap = 1.5 - 1.5 * c; }
  if (kind === 'i') { bob = [0, -1, 0][f]; blink = f === 2; flap = [1, 2, 1][f]; }
  if (hit) { bob = 1; flap = 3; }
  // feet
  p.blob(16, lf, 5.6, 3.6, PINK).blob(32, rf, 5.6, 3.6, PINK);
  // back scarf tail (behind body)
  p.poly([[34, 34 + bob], [41, 31 + bob - flap], [46, 34 + bob - flap], [39, 37 + bob], [34, 38 + bob]], SCARF);
  // body + belly
  p.blob(24, 34 + bob, 14.5, 11, FUR).blob(24, 37 + bob, 9, 6.6, CREAM);
  // paws
  p.blob(10, 36 + bob + arm, 3.6, 4.2, FUR).blob(38, 36 + bob - arm, 3.6, 4.2, FUR);
  p.blob(10, 39 + bob + arm, 2.9, 2.3, CREAM, { dither: 0.2 }).blob(38, 39 + bob - arm, 2.9, 2.3, CREAM, { dither: 0.2 });
  // scarf
  p.blob(24, 34.5 + bob, 12.5, 3.2, SCARF, { dither: 0.3 });
  // ears (before head)
  p.blob(11, 9.5 + bob, 6.2, 6.6, FUR).blob(37, 9.5 + bob, 6.2, 6.6, FUR);
  p.blob(11.5, 10.5 + bob, 3.4, 4, PINK, { bias: 0.05, dither: 0.2 }).blob(36.5, 10.5 + bob, 3.4, 4, PINK, { bias: 0.05, dither: 0.2 });
  // head
  p.blob(24, 21 + bob, 17.5, 13.2, FUR);
  p.blob(24, 12.6 + bob, 4.6, 2.6, ramp('#c97c34'), { dither: 0.2 });   // forehead patch
  p.blob(10.5, 26 + bob, 6, 5, CHEEK, { dither: 0.3 }).blob(37.5, 26 + bob, 6, 5, CHEEK, { dither: 0.3 }); // puffy cheeks
  p.blob(24, 26.5 + bob, 7.4, 5.2, CREAM, { dither: 0.3 });             // muzzle
  p.blob(11.5, 27.5 + bob, 2.6, 1.5, PINK, { dither: 0.1, bias: 0.1 }).blob(36.5, 27.5 + bob, 2.6, 1.5, PINK, { dither: 0.1, bias: 0.1 });
  // face
  if (hit) {
    p.line(13.5, 18 + bob, 20, 21.4 + bob, 1.7, LINE).line(20, 18 + bob, 13.5, 21.4 + bob, 1.7, LINE);
    p.line(34.5, 18 + bob, 28, 21.4 + bob, 1.7, LINE).line(28, 18 + bob, 34.5, 21.4 + bob, 1.7, LINE);
    p.blob(24, 29 + bob, 3.2, 2.6, MOUTH, { dither: 0.2 }).blob(24, 30 + bob, 1.8, 1.1, PINK, { dither: 0.1 });
  } else {
    if (blink) { p.line(14.5, 21 + bob, 20.5, 21 + bob, 1.1, LINE).line(27.5, 21 + bob, 33.5, 21 + bob, 1.1, LINE); }
    else {
      p.blob(17.5, 21 + bob, 3.2, 4, EYE, { dither: 0.15 }).blob(30.5, 21 + bob, 3.2, 4, EYE, { dither: 0.15 });
      p.rect(16.3, 18.8 + bob, 1.8, 1.8, WHITE).rect(29.3, 18.8 + bob, 1.8, 1.8, WHITE);
      p.rect(18.4, 22.8 + bob, 1, 1, [150, 190, 255]).rect(31.4, 22.8 + bob, 1, 1, [150, 190, 255]);
    }
    p.line(13.5, 16.4 + bob, 20.5, 15.6 + bob, 1.1, FUR_D).line(34.5, 16.4 + bob, 27.5, 15.6 + bob, 1.1, FUR_D);
    p.line(21.6, 28.4 + bob, 24, 29.6 + bob, 0.9, MOUTH).line(24, 29.6 + bob, 26.4, 28.4 + bob, 0.9, MOUTH);
    p.blob(22.8, 30.6 + bob, 1.4, 1.8, TEETH, { dither: 0.1 }).blob(25.2, 30.6 + bob, 1.4, 1.8, TEETH, { dither: 0.1 });
  }
  p.blob(24, 24.8 + bob, 2.3, 1.6, PINK, { bias: 0.1, dither: 0.1 });
  // scarf knot
  p.blob(35.5, 35 + bob, 3, 3, SCARF, { dither: 0.2 });
  p.outline(1);
  if (kind === 'w' || kind === 'i') { /* player shadow is drawn by the scene */ }
  if (hit) p.whiten(0.42);
  return p.done();
}

// ================================================================== ENEMIES
function beetle(f = 0, hit = false) {
  const p = new Pix(40), SH = ramp('#4cb843'), SD = ramp('#2a6b32'), LEG = ramp('#3a3d22'), HD = ramp('#2d7a35'), RED = ramp('#ff4a3a');
    const ph = (i) => ((f / WF) + (i % 2) * 0.5) % 1;
  [[9, 17], [7, 24], [9, 31]].forEach(([bx, by], i) => {
    const q = ph(i), lift = -2.5 * Math.max(0, Math.sin(q * 6.2832)), sw = 1.5 * Math.sin(q * 6.2832);
    p.line(bx + 2, by, bx - 5 + sw, by - 2 + lift, 1.8, LEG).line(bx - 5 + sw, by - 2 + lift, bx - 8 + sw, by + 4 + lift * 0.5, 1.8, LEG);
    const q2 = ph(i + 1), l2 = -2.5 * Math.max(0, Math.sin(q2 * 6.2832)), s2 = 1.5 * Math.sin(q2 * 6.2832);
    p.line(40 - bx - 2, by, 40 - bx + 5 - s2, by - 2 + l2, 1.8, LEG).line(40 - bx + 5 - s2, by - 2 + l2, 40 - bx + 8 - s2, by + 4 + l2 * 0.5, 1.8, LEG);
  });
  p.blob(20, 25, 13.5, 12.6, SH);                    // shell
  p.line(20, 13, 20, 37, 1.1, SD);                   // wing split
  p.blob(14.5, 19.5, 3.4, 2.4, ramp('#cdf5a2'), { dither: 0.2 }).blob(27, 29, 2.2, 1.8, ramp('#8de37c'), { dither: 0.2 });
  [[14, 30, 2], [26, 21, 1.8], [12, 24, 1.4]].forEach(([x, y, r]) => p.blob(x, y, r, r, SD, { dither: 0.3 }));
  p.poly([[16, 8], [14, 0.5], [19, 6]], ramp('#d8c59a')).poly([[24, 8], [26, 0.5], [21, 6]], ramp('#d8c59a')); // horns
  p.blob(20, 11, 7.4, 5.6, HD);                      // head
  p.poly([[15, 14], [13, 18.5], [18, 15.5]], ramp('#efe3c0'), { dither: 0.3 }).poly([[25, 14], [27, 18.5], [22, 15.5]], ramp('#efe3c0'), { dither: 0.3 });
  if (hit) { p.line(14.5, 8.8, 18.5, 11, 1.5, LINE).line(18.5, 8.8, 14.5, 11, 1.5, LINE).line(21.5, 8.8, 25.5, 11, 1.5, LINE).line(25.5, 8.8, 21.5, 11, 1.5, LINE); }
  else { p.blob(16.8, 10.6, 2, 2.2, RED, { dither: 0.2 }).blob(23.2, 10.6, 2, 2.2, RED, { dither: 0.2 }); p.rect(16.3, 9.6, 1, 1, WHITE).rect(22.7, 9.6, 1, 1, WHITE); }
  p.outline(1).shadow(20, 37, 12, 3.2);
  return (hit ? p.whiten(0.45) : p).done();
}
function ant(f = 0, hit = false) {
  const p = new Pix(40), RB = ramp('#d2392d'), RD = ramp('#8c2220'), LEG = ramp('#4a1a1a'), YEL = ramp('#ffe066');
  const sw = (i) => Math.sin((f / WF) * Math.PI * 2 + (i % 2) * Math.PI);
  [[18, 17], [18, 21], [18, 25]].forEach(([bx, by], i) => {
    const a = sw(i) * 2.2, b = sw(i + 1) * 2.2;
    p.line(bx, by, bx - 6, by - 2 + a * 0.4, 1.5, LEG).line(bx - 6, by - 2 + a * 0.4, bx - 9, by + 3 + a, 1.5, LEG);
    p.line(40 - bx, by, 40 - bx + 6, by - 2 + b * 0.4, 1.5, LEG).line(40 - bx + 6, by - 2 + b * 0.4, 40 - bx + 9, by + 3 + b, 1.5, LEG);
  });
  p.blob(20, 31.5, 6.6, 8.2, RB);                     // abdomen
  p.line(14.5, 29.5, 25.5, 29.5, 0.9, RD).line(14.2, 33.5, 25.8, 33.5, 0.9, RD);
  p.blob(20, 21, 4.6, 5, RB);                         // thorax
  p.blob(20, 11, 6.2, 5.6, RB);                       // head
  const aw = Math.sin(f / WF * Math.PI * 2) * 1.5;
  p.line(17, 6, 12, 1 + aw, 1.1, LEG).line(23, 6, 28, 1 - aw, 1.1, LEG);
  p.poly([[15.5, 14], [12.5, 18], [17.5, 16]], ramp('#f0d2a0'), { dither: 0.2 }).poly([[24.5, 14], [27.5, 18], [22.5, 16]], ramp('#f0d2a0'), { dither: 0.2 });
  if (hit) { p.line(14.6, 9, 18.2, 11.4, 1.4, LINE).line(18.2, 9, 14.6, 11.4, 1.4, LINE).line(21.8, 9, 25.4, 11.4, 1.4, LINE).line(25.4, 9, 21.8, 11.4, 1.4, LINE); }
  else { p.blob(16.7, 10.6, 2.2, 2.4, YEL, { dither: 0.2 }).blob(23.3, 10.6, 2.2, 2.4, YEL, { dither: 0.2 }); p.rect(16.4, 9.6, 1, 1, [40, 10, 10]).rect(23, 9.6, 1, 1, [40, 10, 10]); }
  p.blob(17.5, 18.8, 1.8, 1.2, ramp('#f6a095'), { dither: 0.1 });
  p.outline(1).shadow(20, 37, 10, 3);
  return (hit ? p.whiten(0.45) : p).done();
}
function snake(f = 0, hit = false) {
  const p = new Pix(48), B = ramp('#8a56d4'), BD = ramp('#4a2a8a'), BELLY = ramp('#d8c2f5'), YEL = ramp('#ffe14d');
  const ph = (f / WF) * Math.PI * 2, n = 11;
  const seg = [];
  for (let i = 0; i < n; i++) { const t = i / (n - 1); seg.push([8 + t * 27, 36 - t * 14 + Math.sin(ph + t * 7) * 3.4, 3.6 + t * 3.8]); }
  seg.forEach(([x, y, r], i) => {
    p.blob(x, y, r, r * 0.92, B);
    if (i % 2 === 0 && i > 0 && i < n - 1) p.blob(x, y - r * 0.2, r * 0.5, r * 0.4, BD, { dither: 0.3 });
    p.blob(x - 0.3, y + r * 0.48, r * 0.55, r * 0.28, BELLY, { dither: 0.2 });
  });
  const [hx, hy] = [seg[n - 1][0] + 4, seg[n - 1][1] - 3];
  const tg = 1.75 - 1.75 * CY(f);
  if (!hit) { p.line(hx + 6, hy + 3, hx + 10 + tg, hy + 3, 0.9, ramp('#ff3b4e')); p.line(hx + 10 + tg, hy + 3, hx + 12 + tg, hy + 1.5, 0.8, ramp('#ff3b4e')); p.line(hx + 10 + tg, hy + 3, hx + 12 + tg, hy + 4.7, 0.8, ramp('#ff3b4e')); }
  p.blob(hx, hy, 8.2, 6.4, B);
  p.blob(hx + 1.5, hy + 3, 5.4, 2.6, BELLY, { dither: 0.2 });
  p.blob(hx - 1, hy - 3.2, 2.6, 1.4, BD, { dither: 0.3 });
  if (hit) { p.line(hx - 3.8, hy - 3, hx - 1, hy - 0.8, 1.4, LINE).line(hx - 1, hy - 3, hx - 3.8, hy - 0.8, 1.4, LINE).line(hx + 2.2, hy - 3, hx + 5, hy - 0.8, 1.4, LINE).line(hx + 5, hy - 3, hx + 2.2, hy - 0.8, 1.4, LINE); }
  else { p.blob(hx - 2.5, hy - 1.8, 1.9, 2.3, YEL, { dither: 0.2 }).blob(hx + 3.6, hy - 1.8, 1.9, 2.3, YEL, { dither: 0.2 }); p.rect(hx - 2.9, hy - 2.4, 0.9, 2.2, [30, 10, 40]).rect(hx + 3.2, hy - 2.4, 0.9, 2.2, [30, 10, 40]); }
  p.outline(1).shadow(22, 42, 15, 3.4);
  return (hit ? p.whiten(0.45) : p).done();
}
const CAT_G = ramp('#9ca6b4'), CAT_L = ramp('#d3d9e0'), CAT_R = ramp('#d24848'), CAT_RL = ramp('#f0a0a0'), GOLD = ramp('#ffc928'), CEYE = ramp('#ffe24a');
/** gray cat (48) or red boss (128, k = 128/48). f: 0-3 walk, enraged adds glow */
function cat(f = 0, hit = false, boss = false, rage = false) {
  const size = boss ? 128 : 48, k = size / 48, p = new Pix(size, size, k);
  const G = boss ? (rage ? ramp('#e03a2a') : CAT_R) : CAT_G, L = boss ? CAT_RL : CAT_L;
  const bob = BOB(f), lf = 42 + CY(f), rf = 42 - CY(f), tail = -2 * CY(f);
  // tail
  p.line(40, 36 + bob, 45 + tail * 0.4, 28 + bob, 3.6, G).line(45 + tail * 0.4, 28 + bob, 43 + tail, 19 + bob, 3.2, G);
  p.blob(43 + tail, 18.5 + bob, 2.4, 2.4, L, { dither: 0.3 });
  // legs / paws
  p.blob(15, lf, 6, 3.8, L).blob(33, rf, 6, 3.8, L);
  // body
  p.blob(24, 33 + bob, 16, 12, G).blob(24, 36 + bob, 10, 8, L);
  if (boss) { // spiked collar + shoulder pads
    p.blob(24, 31.5 + bob, 14.5, 3.6, ramp('#5a3a22'), { dither: 0.4 });
    [-10, -5, 0, 5, 10].forEach((dx) => p.poly([[24 + dx - 1.8, 32 + bob], [24 + dx, 28 + bob], [24 + dx + 1.8, 32 + bob]], ramp('#d8dce2'), { dither: 0.2 }));
    p.blob(8.5, 31 + bob, 5.4, 4.4, ramp('#7a2a2a')).blob(39.5, 31 + bob, 5.4, 4.4, ramp('#7a2a2a'));
    p.poly([[5.5, 28 + bob], [8, 22 + bob], [10.5, 28 + bob]], ramp('#d8dce2'), { dither: 0.2 }).poly([[37.5, 28 + bob], [40, 22 + bob], [42.5, 28 + bob]], ramp('#d8dce2'), { dither: 0.2 });
  }
  // ears
  p.poly([[7, 16 + bob], [8, 3 + bob], [20, 10.5 + bob]], G).poly([[41, 16 + bob], [40, 3 + bob], [28, 10.5 + bob]], G);
  p.poly([[10, 13 + bob], [10.5, 7 + bob], [16, 11.2 + bob]], ramp('#f08aa0'), { dither: 0.3 }).poly([[38, 13 + bob], [37.5, 7 + bob], [32, 11.2 + bob]], ramp('#f08aa0'), { dither: 0.3 });
  // head
  p.blob(24, 21 + bob, 17, 12.5, G);
  p.blob(24, 25.5 + bob, 9.5, 6.6, L, { dither: 0.5 });
  [[-6, 14.5], [0, 12.6], [6, 14.5]].forEach(([dx, y]) => p.poly([[24 + dx - 1.1, 14.4 + bob + (y - 12.6) * 0.1], [24 + dx, 10.2 + bob], [24 + dx + 1.1, 14.4 + bob + (y - 12.6) * 0.1]], boss ? ramp('#8a1a1a') : ramp('#6e7886'), { dither: 0.2 })); // forehead stripes
  // eyes
  if (hit) {
    p.line(10.5, 17 + bob, 18.5, 20.5 + bob, 1.9, LINE).line(18.5, 17 + bob, 10.5, 20.5 + bob, 1.9, LINE);
    p.line(29.5, 17 + bob, 37.5, 20.5 + bob, 1.9, LINE).line(37.5, 17 + bob, 29.5, 20.5 + bob, 1.9, LINE);
    p.blob(24, 29 + bob, 3.6, 2.8, MOUTH, { dither: 0.3 });
  } else {
    const ec = boss ? ramp(rage ? '#ffffff' : '#ffb02e') : CEYE;
    p.blob(15, 19.6 + bob, 4.6, 3.8, ec, { dither: 0.2 }).blob(33, 19.6 + bob, 4.6, 3.8, ec, { dither: 0.2 });
    p.rect(14.2, 17.4 + bob, 1.8, 4.5, boss ? [90, 10, 10] : [20, 14, 30]).rect(32.2, 17.4 + bob, 1.8, 4.5, boss ? [90, 10, 10] : [20, 14, 30]);
    p.line(8.5, 15.2 + bob, 19, 17.4 + bob, 1.6, boss ? ramp('#5a1010') : ramp('#566070')).line(39.5, 15.2 + bob, 29, 17.4 + bob, 1.6, boss ? ramp('#5a1010') : ramp('#566070')); // angry brows
    if (boss) p.line(34, 14 + bob, 38.5, 24 + bob, 1.1, ramp('#3a0a0a')); // scar
  }
  // nose, mouth, fangs, whiskers
  p.poly([[22, 24 + bob], [26, 24 + bob], [24, 26.4 + bob]], ramp('#f08aa0'), { dither: 0.2 });
  if (!hit) {
    p.line(24, 26.4 + bob, 24, 28 + bob, 0.8, MOUTH).line(24, 28 + bob, 20.8, 29.4 + bob, 0.8, MOUTH).line(24, 28 + bob, 27.2, 29.4 + bob, 0.8, MOUTH);
    p.poly([[20.2, 28.6 + bob], [21.8, 28.8 + bob], [21, 32 + bob]], TEETH, { dither: 0.1 }).poly([[26.2, 28.8 + bob], [27.8, 28.6 + bob], [27, 32 + bob]], TEETH, { dither: 0.1 });
  }
  [[-1, 0], [-1, 1.6], [1, 0], [1, 1.6]].forEach(([s, o]) => p.line(24 + s * 11, 26.2 + o + bob, 24 + s * 19, 24.4 + o * 1.5 + bob, 0.7, ramp('#eef2f6')));
  if (boss) { // crown
    p.poly([[13, 12 + bob], [14, 2 + bob], [19, 8 + bob], [24, -0.5 + bob], [29, 8 + bob], [34, 2 + bob], [35, 12 + bob]], GOLD, { dither: 0.5 });
    p.slab(13, 10 + bob, 22, 3.2, GOLD);
    p.blob(24, 7 + bob, 2, 2, ramp('#ff3b5e'), { dither: 0.2 }).blob(17, 10.8 + bob, 1.2, 1.2, ramp('#4ad0ff'), { dither: 0.2 }).blob(31, 10.8 + bob, 1.2, 1.2, ramp('#4ad0ff'), { dither: 0.2 });
  }
  p.outline(boss ? 2 : 1).shadow(24, 45.5, boss ? 20 : 17, 3.4);
  return (hit ? p.whiten(0.5) : p).done();
}
function bat(f = 0, hit = false) {
  const p = new Pix(48), W = ramp('#6a3fa8'), WB = ramp('#3a2070'), BODY = ramp('#8a5cc8'), fl = -7 * CY(f);
  const wing = (s) => {
    const X = (x) => 24 + s * (x - 24);
    p.poly([[X(24), 22], [X(2), 9 + fl * 0.5], [X(0), 17 + fl], [X(8), 22 + fl * 0.6], [X(10), 30 + fl * 0.3], [X(17), 28], [X(20), 36]], W, { dither: 0.6 });
    p.line(X(23), 22, X(3), 9 + fl * 0.5, 1.2, WB).line(X(23), 22, X(1), 17 + fl, 1, WB).line(X(23), 22, X(10), 30 + fl * 0.3, 1, WB);
  };
  wing(1); wing(-1);
  p.poly([[17, 14], [15, 3], [22, 11]], BODY).poly([[31, 14], [33, 3], [26, 11]], BODY);
  p.poly([[17.8, 12], [16.8, 6.5], [20.5, 11]], ramp('#f08aa0'), { dither: 0.2 }).poly([[30.2, 12], [31.2, 6.5], [27.5, 11]], ramp('#f08aa0'), { dither: 0.2 });
  p.blob(24, 26, 9, 10, BODY).blob(24, 29, 5.6, 6, ramp('#c9a8ee'), { dither: 0.4 });
  p.blob(24, 19, 8.4, 7.2, BODY);
  if (hit) { p.line(16.5, 16.5, 21, 19.5, 1.5, LINE).line(21, 16.5, 16.5, 19.5, 1.5, LINE).line(27, 16.5, 31.5, 19.5, 1.5, LINE).line(31.5, 16.5, 27, 19.5, 1.5, LINE); p.blob(24, 24, 2.6, 2, MOUTH, { dither: 0.2 }); }
  else {
    p.blob(19.3, 18.6, 2.3, 2.6, ramp('#ffe066'), { dither: 0.2 }).blob(28.7, 18.6, 2.3, 2.6, ramp('#ffe066'), { dither: 0.2 }); p.rect(19, 17.6, 1, 2.2, [40, 10, 30]).rect(28.4, 17.6, 1, 2.2, [40, 10, 30]);
    p.poly([[21, 23], [23, 23], [22, 26.6]], TEETH, { dither: 0.1 }).poly([[25, 23], [27, 23], [26, 26.6]], TEETH, { dither: 0.1 });
    p.line(22, 21.4, 24, 22.4, 0.7, MOUTH).line(24, 22.4, 26, 21.4, 0.7, MOUTH);
  }
  p.outline(1).shadow(24, 45, 9, 2.4, 70);
  return (hit ? p.whiten(0.45) : p).done();
}
function boar(f = 0, hit = false) {
  const p = new Pix(64), B = ramp('#8c5a38'), BL = ramp('#b8845c'), MANE = ramp('#4a2a1a'), SNOUT = ramp('#e0a090'), IV = ramp('#fff4d8'), HOOF = ramp('#2a1a14');
  const bob = BOB(f), lf = 54.8 + 1.2 * CY(f), rf = 54.8 - 1.2 * CY(f);
    // hooves
  p.blob(19, lf + 1, 5, 4, HOOF).blob(45, rf + 1, 5, 4, HOOF);
  p.blob(22, lf - 4, 5.2, 6, B).blob(42, rf - 4, 5.2, 6, B);
  // body + mane
  p.blob(32, 38 + bob, 25, 17, B);
  for (let i = 0; i < 7; i++) { const x = 11 + i * 7; p.poly([[x - 3.6, 26 + bob], [x + 0.2, 14 + bob + Math.abs(i - 3) * 1.4], [x + 3.6, 26 + bob]], MANE, { dither: 0.4 }); }
  p.blob(32, 29 + bob, 20, 6.5, MANE, { dither: 0.5 });
  p.blob(32, 46 + bob, 15, 8, BL, { dither: 0.5 });
  // ears
  p.poly([[11, 30 + bob], [8, 20 + bob], [19, 26 + bob]], B).poly([[53, 30 + bob], [56, 20 + bob], [45, 26 + bob]], B);
  // head
  p.blob(32, 36 + bob, 19, 14, B);
  p.blob(32, 42 + bob, 11, 7.6, SNOUT);
  p.blob(28, 42.5 + bob, 1.8, 2.2, MANE, { dither: 0.2 }).blob(36, 42.5 + bob, 1.8, 2.2, MANE, { dither: 0.2 });
  // tusks
  p.poly([[16, 44 + bob], [20, 50 + bob], [25, 44.5 + bob]], IV, { dither: 0.2 }).poly([[48, 44 + bob], [44, 50 + bob], [39, 44.5 + bob]], IV, { dither: 0.2 });
  p.poly([[13.5, 40 + bob], [12, 33 + bob], [18.5, 43 + bob]], IV, { dither: 0.2 }).poly([[50.5, 40 + bob], [52, 33 + bob], [45.5, 43 + bob]], IV, { dither: 0.2 });
  // eyes
  if (hit) { p.line(17, 31 + bob, 24, 35 + bob, 2, LINE).line(24, 31 + bob, 17, 35 + bob, 2, LINE).line(40, 31 + bob, 47, 35 + bob, 2, LINE).line(47, 31 + bob, 40, 35 + bob, 2, LINE); }
  else {
    p.blob(21, 33.5 + bob, 3, 3, ramp('#ffd23a'), { dither: 0.2 }).blob(43, 33.5 + bob, 3, 3, ramp('#ffd23a'), { dither: 0.2 });
    p.rect(20.2, 32.5 + bob, 1.8, 2.4, [60, 8, 8]).rect(42.2, 32.5 + bob, 1.8, 2.4, [60, 8, 8]);
    p.line(15, 29 + bob, 26, 32 + bob, 2, MANE).line(49, 29 + bob, 38, 32 + bob, 2, MANE);
  }
  p.outline(1).shadow(32, 61, 24, 3.2);
  return (hit ? p.whiten(0.5) : p).done();
}
function spitter(f = 0, hit = false) {
  const p = new Pix(48), B = ramp('#6fa03a'), BL = ramp('#b7d86a'), SPOT = ramp('#456e22'), bob = -SN(f), mo = 1.5 - 1.5 * CY(f);
  p.blob(10, 40, 4.4, 3.2, B).blob(38, 40, 4.4, 3.2, B);           // feet
  p.blob(24, 31 + bob, 16.5, 12.5, B).blob(24, 36 + bob, 10.5, 7.5, BL, { dither: 0.5 });
  [[14, 27, 2], [34, 29, 1.8], [30, 24, 1.3]].forEach(([x, y, r]) => p.blob(x, y + bob, r, r, SPOT, { dither: 0.3 }));
  p.blob(24, 21 + bob, 15, 10.5, B);
  p.blob(13, 12.5 + bob, 6, 5.8, B).blob(35, 12.5 + bob, 6, 5.8, B);  // eye bulges
  if (hit) { p.line(10, 10 + bob, 16, 14 + bob, 1.8, LINE).line(16, 10 + bob, 10, 14 + bob, 1.8, LINE).line(32, 10 + bob, 38, 14 + bob, 1.8, LINE).line(38, 10 + bob, 32, 14 + bob, 1.8, LINE); }
  else {
    p.blob(13, 12.5 + bob, 3.8, 3.8, ramp('#ffe56a'), { dither: 0.2 }).blob(35, 12.5 + bob, 3.8, 3.8, ramp('#ffe56a'), { dither: 0.2 });
    p.rect(12.3, 10.8 + bob, 1.6, 3.8, [30, 20, 10]).rect(34.3, 10.8 + bob, 1.6, 3.8, [30, 20, 10]);
  }
  // mouth + tongue + drool
  p.blob(24, 26 + bob + mo * 0.3, 10, 3.2 + mo, ramp('#2a0e1c'), { dither: 0.2 });
  p.blob(24, 27.6 + bob + mo * 0.5, 5, 1.6 + mo * 0.5, ramp('#ff5a78'), { dither: 0.3 });
  p.poly([[16.5, 24 + bob], [18.5, 24 + bob], [17.5, 27 + bob]], TEETH, { dither: 0.1 }).poly([[29.5, 24 + bob], [31.5, 24 + bob], [30.5, 27 + bob]], TEETH, { dither: 0.1 });
  p.blob(24, 15.5 + bob, 1, 1, SPOT, { dither: 0 }).blob(21, 17 + bob, 0.9, 0.9, SPOT, { dither: 0 });
  if (mo > 2 && !hit) p.blob(24, 32 + bob + mo, 1.4, 2, ramp('#8aff4d'), { dither: 0.1 });
  p.outline(1).shadow(24, 46, 16, 2.4);
  return (hit ? p.whiten(0.45) : p).done();
}

// ================================================================== PROJECTILES / PICKUPS (2x density)
function seed() { // sunflower-seed bullet, points right (16x16)
  const p = new Pix(16);
  p.blob(8, 8, 7, 3.9, ramp('#f1ead0'), { dither: 0.4 });
  p.line(2.5, 8, 13.5, 8, 1.2, ramp('#2b2018')); p.line(4, 6.1, 11, 6.3, 0.6, ramp('#8a7a5a')); p.line(4, 9.9, 11, 9.7, 0.6, ramp('#8a7a5a'));
  p.blob(13.4, 8, 1.4, 1.4, ramp('#d8c68a'), { dither: 0 });
  return p.outline(1).done();
}
function spit() { const p = new Pix(14); p.blob(7, 7, 6, 6, ramp('#6fe03a'), { dither: 0.5 }); p.blob(5, 5, 2.4, 2, ramp('#eaffc0'), { dither: 0 }); p.rect(9, 9, 1.4, 1.4, [30, 120, 20]); return p.outline(1).done(); }
function bomb() { // hazelnut bomb (18x18)
  const p = new Pix(18), N = ramp('#b4763a');
  p.blob(9, 11, 7, 6.8, N); p.blob(9, 5.8, 6.4, 3.4, ramp('#7a4a22'), { dither: 0.5 });
  for (let i = 0; i < 4; i++) p.line(4.5 + i * 3, 4.2, 5 + i * 3, 7.4, 0.6, ramp('#4a2a12'));
  p.blob(6.5, 10, 2, 1.6, ramp('#f0c890'), { dither: 0.1 });
  p.line(9, 3.2, 11, 0.8, 1, ramp('#6a4a2a')); p.blob(11.6, 0.8, 1.5, 1.5, ramp('#ffd23a'), { dither: 0 }); p.rect(11, 0, 1, 1, WHITE);
  return p.outline(1).done();
}
function gem(base, shape = 0) { // 16x16 faceted crystal
  const p = new Pix(16), R = ramp(base, 5);
  if (shape === 0) { p.poly([[8, 1], [14, 6], [8, 15], [2, 6]], R, { dither: 0.3 }); p.poly([[8, 1], [11, 6], [8, 15]], R, { flat: 1 }).poly([[8, 1], [5, 6], [2, 6]], R, { flat: 4 }).poly([[8, 1], [14, 6], [11, 6]], R, { flat: 3 }); p.poly([[2, 6], [5, 6], [8, 15]], R, { flat: 2 }); }
  else { p.poly([[8, 1], [13, 4], [14, 10], [8, 15], [2, 10], [3, 4]], R, { dither: 0.3 }); p.poly([[8, 1], [13, 4], [8, 7]], R, { flat: 4 }).poly([[8, 1], [3, 4], [8, 7]], R, { flat: 3 }).poly([[8, 7], [14, 10], [8, 15]], R, { flat: 1 }).poly([[8, 7], [2, 10], [8, 15]], R, { flat: 2 }); }
  p.rect(5, 4, 2, 2, WHITE); p.rect(7, 3, 1, 1, WHITE);
  return p.outline(1).done();
}
function heart() { // 20x20
  const p = new Pix(20), R = ramp('#ff3b5e');
  p.blob(6.4, 7, 5.6, 5.4, R).blob(13.6, 7, 5.6, 5.4, R);
  p.poly([[1, 9], [19, 9], [10, 19.4]], R, { dither: 0.5 });
  p.blob(5.5, 5.5, 2, 1.5, ramp('#ffc7d2'), { dither: 0 }); p.rect(3.6, 7.5, 1, 1, WHITE);
  return p.outline(1).done();
}
function wheelBlade() { // hamster-wheel saw (28x28)
  const p = new Pix(28), R = ramp('#ffc928'), S = ramp('#8a6a20');
  p.blob(14, 14, 13, 13, R, { dither: 0.5 });
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; p.poly([[14 + Math.cos(a - 0.2) * 12, 14 + Math.sin(a - 0.2) * 12], [14 + Math.cos(a) * 14, 14 + Math.sin(a) * 14], [14 + Math.cos(a + 0.2) * 12, 14 + Math.sin(a + 0.2) * 12]], R, { dither: 0.3 }); }
  p.blob(14, 14, 8.2, 8.2, ramp('#241a10'), { dither: 0 });
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4; p.line(14, 14, 14 + Math.cos(a) * 9, 14 + Math.sin(a) * 9, 1.3, R); }
  p.blob(14, 14, 2.6, 2.6, R, { dither: 0.3 });
  return p.outline(1).done();
}
function blockChest() { // golden block cube (24x24)
  const p = new Pix(24), R = ramp('#ffc928');
  p.poly([[12, 2], [22, 7], [12, 12], [2, 7]], R, { flat: 4 });
  p.poly([[2, 7], [12, 12], [12, 23], [2, 17.5]], R, { flat: 2 });
  p.poly([[22, 7], [12, 12], [12, 23], [22, 17.5]], R, { flat: 0 });
  p.line(12, 12, 12, 23, 0.8, ramp('#8a5a10')); p.line(2, 7, 12, 12, 0.7, ramp('#fff1a0')); p.line(12, 12, 22, 7, 0.7, ramp('#fff1a0'));
  p.blob(12, 7, 2, 1.2, ramp('#fff8d0'), { dither: 0 });
  p.rect(5, 12, 1, 1, WHITE);
  return p.outline(1).done();
}
function chestBig(open) { // 48x48
  const p = new Pix(48), W = ramp('#a8602c'), M = ramp('#d6a83a'), M2 = ramp('#8a8f99');
  if (open) { // glow
    p.blob(24, 22, 17, 12, ramp('#fff2a8'), { dither: 0.9, bias: 0.4 });
  }
  p.slab(5, 22, 38, 20, W);
  [[5, 22, 3], [40, 22, 3], [5, 38, 3], [40, 38, 3]].forEach(([x, y, w]) => p.slab(x, y, w, 4, M2));
  p.slab(5, 30, 38, 2.4, M); p.slab(21, 24, 6, 13, M);
  p.blob(24, 31, 2.2, 2.2, ramp('#2a1a0a'), { dither: 0 });
  if (!open) {
    p.poly([[5, 22], [43, 22], [41, 11], [7, 11]], W, { dither: 0.6 });
    p.slab(5, 20, 38, 2.6, M); p.slab(21, 10, 6, 12, M); p.slab(7, 11, 34, 2, M);
    p.blob(24, 20.5, 2.4, 2.4, ramp('#f8e8a0'), { dither: 0.2 });
  } else {
    p.poly([[5, 22], [43, 22], [44, 6], [4, 6]], W, { dither: 0.6 }); p.slab(4, 5, 40, 2.4, M);
    p.slab(5, 22, 38, 2, ramp('#4a2a12'));
    p.blob(24, 21, 15, 3.2, ramp('#fff4b0'), { dither: 0.2, bias: 0.3 });
    [[14, 17], [24, 14], [34, 17]].forEach(([x, y], i) => p.blob(x, y, 2, 2, ramp(['#ff6b6b', '#5cc8ff', '#5be37d'][i]), { dither: 0.1 }));
  }
  return p.outline(1).done();
}

// ---------------- item icons (32x32)
function itemIcon(slot) {
  const p = new Pix(32);
  if (slot === 'weapon') {
    const M = ramp('#a8b2c0'), WD = ramp('#8a5428');
    p.poly([[3, 12], [20, 12], [20, 19], [3, 19]], M, { dither: 0.4 }).slab(3, 12, 17, 3, M);
    p.poly([[20, 11], [29, 14], [29, 18], [20, 21]], WD).blob(3.5, 15.5, 2.6, 3.6, ramp('#f1ead0'), { dither: 0.2 });
    p.poly([[10, 19], [14, 19], [13, 28], [8, 28]], WD).slab(21, 12.5, 4, 2, ramp('#ffc928'));
    p.blob(10, 14, 4, 1, ramp('#e8eef4'), { dither: 0, bias: 0.2 });
  } else if (slot === 'helm') {
    const M = ramp('#b8c4d0'), G = ramp('#ffc928');
    p.blob(16, 18, 13, 12, M); p.slab(3, 20, 26, 5, ramp('#6f7a88')); p.slab(14, 4, 4, 8, G);
    p.poly([[14, 3], [18, 3], [16, 0]], G, { dither: 0.2 }); p.blob(10, 13, 3.4, 2, ramp('#f4f8fb'), { dither: 0, bias: 0.2 });
    p.rect(8, 24, 16, 2, [30, 26, 40]); p.blob(16, 18, 2.6, 2.6, ramp('#ff3b5e'), { dither: 0.2 });
  } else {
    const G = ramp('#ffc928');
    p.line(16, 1, 16, 8, 1.4, ramp('#a8b2c0')); p.blob(16, 19, 11, 11, G); p.blob(16, 19, 6.4, 6.4, ramp('#ff3b7a'), { dither: 0.3 });
    p.blob(13.5, 16.5, 2, 1.6, ramp('#ffd0e0'), { dither: 0, bias: 0.3 }); p.rect(12, 15, 1.4, 1.4, WHITE);
  }
  return p.outline(1).done();
}
// ---------------- upgrade icons (32x32)
const ICON = {
  dmg: () => { const p = new Pix(32); p.blob(16, 16, 12, 6.4, ramp('#f1ead0'), { dither: 0.4 }); p.line(5, 16, 27, 16, 1.6, ramp('#2b2018')); p.line(8, 12, 22, 12.5, 0.8, ramp('#8a7a5a')); p.poly([[24, 11], [31, 16], [24, 21]], ramp('#ff5a3a'), { dither: 0.2 }); return p; },
  rate: () => { const p = new Pix(32); p.poly([[19, 2], [7, 18], [14, 18], [11, 30], [25, 12], [17, 12]], ramp('#ffd23f'), { dither: 0.5 }); return p; },
  multi: () => { const p = new Pix(32); [[8, 7], [18, 15], [8, 23]].forEach(([x, y]) => { p.blob(x + 6, y, 7, 3.4, ramp('#f1ead0'), { dither: 0.4 }); p.line(x, y, x + 11, y, 1.2, ramp('#2b2018')); }); return p; },
  pierce: () => { const p = new Pix(32); p.line(2, 16, 22, 16, 3.4, ramp('#b8c4d0')); p.poly([[30, 16], [20, 6], [20, 26]], ramp('#e8eef4'), { dither: 0.3 }); p.line(5, 15, 18, 15, 0.8, ramp('#ffffff')); return p; },
  speed: () => { const p = new Pix(32); p.poly([[8, 4], [18, 4], [18, 16], [29, 21], [29, 27], [8, 27]], ramp('#c0762c'), { dither: 0.4 }); p.slab(8, 25, 21, 3, ramp('#e8eef4')); p.line(4, 10, 0, 10, 1, ramp('#ffffff')); p.line(5, 15, 0, 15, 1, ramp('#ffffff')); return p; },
  hp: () => { const p = new Pix(32); const R = ramp('#ff3b5e'); p.blob(10, 11, 8.6, 8, R).blob(22, 11, 8.6, 8, R); p.poly([[2, 14], [30, 14], [16, 30]], R, { dither: 0.5 }); p.blob(8, 8.5, 3, 2.2, ramp('#ffc7d2'), { dither: 0 }); return p; },
  magnet: () => { const p = new Pix(32); const R = ramp('#e03a3a'); p.blob(16, 15, 12.5, 12.5, R, { dither: 0.5 }); p.clearEllipse(16, 15, 6.2, 6.2); p.clear(0, 15, 32, 17); p.slab(3.5, 15, 6.3, 13, R); p.slab(22.2, 15, 6.3, 13, R); p.slab(3.5, 24, 6.4, 4, ramp('#e8eef4')); p.slab(22.1, 24, 6.4, 4, ramp('#e8eef4')); return p; },
  xp: () => gem('#5cc8ff', 0).scaled(2),
  blade: () => wheelBlade().scaled(1),
  crit: () => { const p = new Pix(32); p.poly([[16, 1], [20, 11], [31, 12], [22.5, 19], [25.5, 30], [16, 24], [6.5, 30], [9.5, 19], [1, 12], [12, 11]], ramp('#ffd23f'), { dither: 0.5 }); p.blob(13, 11, 2.4, 2, ramp('#fff8d0'), { dither: 0 }); return p; },
  nova: () => { const p = new Pix(32); p.blob(16, 16, 14, 14, ramp('#6fd3ff'), { dither: 0.5 }); p.blob(16, 16, 9.6, 9.6, ramp('#16303a'), { dither: 0 }); p.blob(16, 16, 5, 5, ramp('#e6fbff'), { dither: 0.4 }); return p; },
  bomb: () => bomb().scaled(2),
  vamp: () => { const p = new Pix(32); p.poly([[3, 3], [13, 3], [8, 29]], ramp('#fff4e0'), { dither: 0.3 }); p.poly([[19, 3], [29, 3], [24, 29]], ramp('#fff4e0'), { dither: 0.3 }); p.blob(8, 9, 1.8, 1.8, ramp('#ff3b5e'), { dither: 0 }); p.blob(24, 9, 1.8, 1.8, ramp('#ff3b5e'), { dither: 0 }); return p; },
  regen: () => { const p = new Pix(32); const R = ramp('#5be37d'); p.slab(12, 3, 8, 26, R); p.slab(3, 12, 26, 8, R); p.blob(13, 8, 1.4, 1.4, ramp('#ffffff'), { dither: 0 }); return p; },
};

// ---------------- environment
function grass() { // seamless 64x64 tile
  const p = new Pix(64), G = ramp('#4c8b45', 6);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const n = (Math.sin(x * 0.19) + Math.cos(y * 0.23) + Math.sin((x + y) * 0.11)) / 6 + 0.5; p._set(x, y, G[clamp(Math.round(1 + n * 2 + (BAYER[(y & 3) * 4 + (x & 3)] - 0.5) * 0.9), 1, 3)]); }
  let s = 1337; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 15; i++) { // blade tufts, wrapped
    const x = (r() * 64) | 0, y = (r() * 64) | 0, h = 3 + ((r() * 3) | 0);
    for (let j = 0; j < h; j++) { p._set((x + (j > 1 ? 1 : 0)) & 63, (y - j) & 63, G[j < 2 ? 5 : 4]); p._set((x - 1 - (j > 1 ? 1 : 0)) & 63, (y - j * 0.8) & 63, G[4]); }
    p._set(x & 63, (y + 1) & 63, G[0]);
  }
  for (let i = 0; i < 9; i++) { const x = (r() * 64) | 0, y = (r() * 64) | 0; p._set(x, y, G[5]); p._set((x + 1) & 63, y, G[5]); p._set(x, (y + 1) & 63, G[0]); }
  return p.done();
}
function flower(col) { // 16x16
  const p = new Pix(16), P = ramp(col), cx = 8, cy = 6;
  p.line(8, 8, 8, 14, 1.2, ramp('#2f7a3a')); p.blob(10.5, 11.5, 2.4, 1.2, ramp('#3f9a4a'), { dither: 0.2 });
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 - 1.57; p.blob(cx + Math.cos(a) * 3.1, cy + Math.sin(a) * 3.1, 2.4, 2.4, P, { dither: 0.3 }); }
  p.blob(cx, cy, 1.9, 1.9, ramp('#ffd23a'), { dither: 0.2 });
  return p.outline(1).done();
}
function rock() { // 24x18
  const p = new Pix(24, 18), R = ramp('#8a8f99');
  p.blob(12, 11, 11, 6.6, R); p.blob(8, 7.5, 5, 3.2, ramp('#c3cad2'), { dither: 0.5 }); p.line(14, 8, 17, 12, 0.7, ramp('#4a4f5a')); p.blob(20, 12.5, 2, 1.2, ramp('#6a7080'), { dither: 0.2 });
  p.outline(1).shadow(12, 16, 10, 1.8, 70);
  return p.done();
}
function dot(col) { const p = new Pix(2); p.rect(0, 0, 2, 2, hex2rgb(col)); return p.done(); }

// ================================================================== registry
const registry = {};
const add = (key, pix) => { registry[key] = pix; };
export const ANIMS = []; // {key, frames:[texKey], rate}

export function buildSprites() {
  if (registry.ham_w0) return registry;
  for (let f = 0; f < WF; f++) add('ham_w' + f, hamster('w', f));
  for (let f = 0; f < 3; f++) add('ham_i' + f, hamster('i', f));
  add('ham_hit', hamster('hit'));
  add('ham0', registry.ham_i0); // portrait / menu pose
  buildHero(add, ANIMS); buildEnemyArt(add, ANIMS); buildIcons(add); buildFx(add);
  const fr = (pre) => Array.from({ length: WF }, (_, f) => pre + f);
  ANIMS.push({ key: 'ham_walk', frames: fr('ham_w'), rate: 16 });
  ANIMS.push({ key: 'ham_idle', frames: ['ham_i0', 'ham_i1', 'ham_i0', 'ham_i1', 'ham_i0', 'ham_i2', 'ham_i1'], rate: 3.5 });
  const enemy = (name, fn, rate) => {
    for (let f = 0; f < WF; f++) add(`${name}_w${f}`, fn(f, false));
    add(`${name}_hit`, fn(0, true));
    ANIMS.push({ key: `${name}_walk`, frames: fr(`${name}_w`), rate: rate * 2 });
  };
  enemy('beetle', beetle, 8); enemy('ant', ant, 12); enemy('snake', snake, 7); enemy('bat', bat, 11); enemy('boar', boar, 8); enemy('spitter', spitter, 6);
  enemy('cat', (f, h) => cat(f, h), 7);
  enemy('boss', (f, h) => cat(f, h, true, false), 5);
  for (let f = 0; f < WF; f++) add(`boss2_w${f}`, cat(f, false, true, true));
  add('boss2_hit', cat(0, true, true, true));
  ANIMS.push({ key: 'boss2_walk', frames: fr('boss2_w'), rate: 16 });
  add('seed', seed()); add('spit', spit()); add('bomb', bomb());
  add('gem1', gem('#5cc8ff', 0)); add('gem2', gem('#5be37d', 1)); add('gem3', gem('#ff6b6b', 0));
  add('heart', heart()); add('blade', wheelBlade()); add('bchest', blockChest());
  add('chest0', chestBig(false)); add('chest1', chestBig(true));
  add('icon_weapon', itemIcon('weapon')); add('icon_helm', itemIcon('helm')); add('icon_charm', itemIcon('charm'));
  add('grass', grass()); add('flower1', flower('#ff8fb1')); add('flower2', flower('#f4f4ff')); add('rock', rock());
  buildWorldArt(add);
  add('px_w', dot('#ffffff')); add('px_r', dot('#ff4d4d')); add('px_g', dot('#7dff7d')); add('px_y', dot('#ffe066'));
  Object.entries(ICON).forEach(([k, f]) => { const p = f(); add('up_' + k, p.finished ? p : p.outline(1).done()); });
  return registry;
}

export function installTextures(scene) {
  const reg = buildSprites();
  Object.entries(reg).forEach(([key, pix]) => { if (!scene.textures.exists(key)) scene.textures.addCanvas(key, pix.c); });
  ANIMS.forEach((a) => { if (!scene.anims.exists(a.key)) scene.anims.create({ key: a.key, frames: a.frames.map((k) => ({ key: k })), frameRate: a.rate, repeat: -1 }); });
}

export function spriteURL(key) { return buildSprites()[key].c.toDataURL(); }
export function spriteCanvas(key) { return buildSprites()[key].c; }

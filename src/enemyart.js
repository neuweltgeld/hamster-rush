// New enemy + boss art (profile views facing right – the game mirrors them for west-bound movement).
import { Pix, ramp } from './pix.js';
const WF = 8, CY = (f) => Math.cos((f / WF) * Math.PI * 2), SN = (f) => Math.sin((f / WF) * Math.PI * 2), BOB = (f) => -(1 - Math.cos((f / WF) * Math.PI * 4)) / 2;
const PINK = ramp('#f27b92'), TEETH = ramp('#fff4e0'), WHITE = [255, 255, 255], BLK = ramp('#2b2430'), MOUTH = ramp('#6a1428');
const glint = (p, x, y, s = 1.2) => p.rect(x, y, s, s, WHITE);

function rat(f) {
  const p = new Pix(48), R = ramp('#8b8478'), RL = ramp('#c2baa8'), TAIL = ramp('#e8a0a8'), bob = BOB(f) * 1.1, cy = CY(f), sn = SN(f);
  p.line(9, 33 + bob, 4, 29 + sn * 2, 1.7, TAIL).line(4, 29 + sn * 2, 2.5, 22 + sn * 3, 1.5, TAIL).line(2.5, 22 + sn * 3, 5, 17 + sn * 3, 1.2, TAIL);
  p.blob(14 + cy * 3.4, 41, 3.8, 3, ramp('#6d665c')).blob(30 - cy * 3.4, 41, 3.8, 3, ramp('#6d665c'));
  p.blob(20, 33 + bob, 14.5, 9.2, R).blob(22, 37.5 + bob, 9.6, 5, RL, { dither: 0.45 });
  p.blob(14, 41, 3.6, 2.6, PINK, { dither: .1 }); p.blob(16 - cy * 3.4, 42, 3.4, 2.6, R); p.blob(34 + cy * 3.4, 42, 3.4, 2.6, R);
  p.blob(35, 30.5 + bob, 9, 7.6, R); p.blob(43, 33 + bob, 5, 3.6, RL, { dither: .3 }); p.blob(46.6, 32.4 + bob, 1.8, 1.6, PINK, { dither: 0 });
  p.blob(30.5, 22.5 + bob, 5, 5.4, R).blob(31, 23.5 + bob, 2.8, 3.2, PINK, { dither: .2, bias: .05 });
  p.blob(37.6, 28.6 + bob, 2.1, 2.1, ramp('#ff4a4a'), { dither: .1 }); p.rect(38.6, 27.6 + bob, 1.1, 1.1, WHITE);
  p.line(42, 34 + bob, 47.5, 32 + bob, .6, ramp('#e8e0d0')).line(42, 35 + bob, 47.5, 36 + bob, .6, ramp('#e8e0d0'));
  p.rect(42.5, 36 + bob, 1.6, 2.4, TEETH[3]);
  return p.outline(1).shadow(24, 45, 16, 2.4, 80).done();
}
function bee(f) {
  const p = new Pix(48), Y = ramp('#f5c523'), a = (f / WF) * Math.PI * 2, bob = Math.sin(a) * 1.8, fl = Math.sin(a * 2), W = ramp('#bfeaff');
  // back wing then front wing
  p.poly([[22, 23 + bob], [13, 8 + bob - fl * 5], [24, 7 + bob - fl * 6], [28, 22 + bob]], W, { dither: .7 });
  p.poly([[24, 23 + bob], [20, 11 + bob + fl * 5], [31, 12 + bob + fl * 4], [30, 23 + bob]], ramp('#e6f6ff'), { dither: .8 });
  p.poly([[8, 29 + bob], [1.5, 31.5 + bob], [8, 33 + bob]], BLK, { dither: .2 });
  p.blob(15, 29 + bob, 10.5, 8, Y);
  for (const x of [11, 16.5, 21.5]) p.blob(x, 29 + bob, 1.9, 7.2, BLK, { dither: .15 });
  p.blob(27, 28 + bob, 7.2, 7, ramp('#e8b21a'), { dither: .6 });
  p.blob(35, 28.5 + bob, 6.4, 6.2, BLK, { dither: .2 });
  p.blob(37.4, 27 + bob, 3, 3.3, ramp('#ff7a3a'), { dither: .2 }); p.rect(38, 25.6 + bob, 1.2, 1.2, WHITE);
  p.line(37, 23 + bob, 41.5, 17 + bob, .9, BLK).line(40, 24 + bob, 45, 20 + bob, .9, BLK); p.blob(41.8, 16.6 + bob, 1.3, 1.3, Y, { dither: 0 }).blob(45.4, 19.6 + bob, 1.3, 1.3, Y, { dither: 0 });
  p.line(40.5, 31.5 + bob, 42.5, 31 + bob, .8, MOUTH);
  for (const [x, o] of [[22, 0], [27, 1.5], [31, 0.5]]) p.line(x, 34 + bob, x - 1.5 + Math.sin(a + o) * 1.2, 39 + bob, .9, BLK);
  return p.outline(1).shadow(24, 45, 11, 2, 60).done();
}
function slime(f) {
  const p = new Pix(48), G = ramp('#59d86a'), s = SN(f) * 0.1;
  p.blob(24, 31 - s * 5, 18 * (1 + s), 14 * (1 - s), G, { dither: .35 });
  p.clear(0, 40.4, 48, 10);
  p.blob(24, 37, 13 * (1 + s), 4, ramp('#8cf59a'), { dither: .6 });
  [[16, 34, 1.5], [31, 36, 1.1], [22, 28, 1]].forEach(([x, y, r]) => p.blob(x, y, r, r, ramp('#c8ffd0'), { dither: .2 }));
  p.blob(14, 22 - s * 5, 4, 3, ramp('#e9ffee'), { dither: .1, bias: .15 });
  p.blob(18, 27 - s * 3, 3, 3.6, ramp('#16301c'), { dither: 0.1 }).blob(30, 27 - s * 3, 3, 3.6, ramp('#16301c'), { dither: 0.1 });
  glint(p, 17, 25.4 - s * 3, 1.4); glint(p, 29, 25.4 - s * 3, 1.4);
  p.line(21, 33 - s * 2, 24, 35 - s * 2, .9, ramp('#16301c')).line(24, 35 - s * 2, 27, 33 - s * 2, .9, ramp('#16301c'));
  p.blob(9 + s * 3, 40, 1.4, 2, G, { dither: 0 });
  return p.outline(1).shadow(24, 43.6, 17, 2.4, 70).done();
}
function mole(f) {
  const p = new Pix(48), M = ramp('#6a5878'), ML = ramp('#9482a2'), YEL = ramp('#ffcf30'), cy = CY(f), bob = BOB(f);
  p.blob(12 - cy * 2, 41.5, 4, 2.8, ramp('#4f4060')).blob(26 + cy * 2, 41.5, 4, 2.8, ramp('#4f4060'));
  p.blob(21, 31.5 + bob, 15.5, 11, M).blob(23, 36 + bob, 10, 6, ML, { dither: .5 });
  p.blob(34.5, 30 + bob, 9.4, 8.2, M); p.blob(42.4, 33.5 + bob, 4.6, 3.6, PINK);
  for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28; p.rect(45.5 + Math.cos(a) * 2.5, 33.4 + bob + Math.sin(a) * 2.5, 1, 1, PINK[3]); }
  p.blob(36.5, 28.5 + bob, 1.2, 1.2, BLK, { dither: 0 });
  // hard hat + lamp
  p.blob(33.5, 22.5 + bob, 9, 5, YEL).rect(24, 24.6 + bob, 20, 1.8, YEL[1]).blob(40.4, 21.8 + bob, 2.8, 2.2, ramp('#fff6a0'), { dither: .1 }); p.rect(34, 18.2 + bob, 1.4, 3, YEL[4]);
  // digging claws
  const ax = 34 + cy * 2.5, ay = 37.5 - Math.abs(SN(f)) * 3 + bob;
  p.blob(ax - 5, ay - 1, 6, 4, M); p.blob(ax, ay, 4.4, 3.6, PINK);
  for (let i = 0; i < 3; i++) p.poly([[ax + 2.6, ay - 2.2 + i * 2.2], [ax + 7, ay - 1.4 + i * 2.2], [ax + 2.6, ay - 0.4 + i * 2.2]], TEETH, { dither: .1 });
  return p.outline(1).shadow(24, 45, 16, 2.4, 80).done();
}
function skunk(f) {
  const p = new Pix(48), B = ramp('#322e3c'), Wt = ramp('#f2f2f4'), bob = BOB(f), cy = CY(f), sw = SN(f) * 2;
  p.blob(8 + sw * .5, 19 + sw * .5, 6.8, 13.5, B).blob(8.5 + sw * .5, 17 + sw * .5, 2.4, 10, Wt, { dither: .35 });
  p.blob(14 + cy * 3, 41, 3.6, 3, B).blob(30 - cy * 3, 41, 3.6, 3, B);
  p.blob(21, 33 + bob, 14.5, 9.6, B).blob(18, 26.8 + bob, 12, 2.8, Wt, { dither: .35 });
  p.blob(16 - cy * 3, 42, 3.6, 2.6, B).blob(32 + cy * 3, 42, 3.6, 2.6, B);
  p.blob(35, 31 + bob, 8.6, 7.4, B); p.blob(42, 33.5 + bob, 4.2, 3.2, ramp('#4a4458')); glint(p, 44.4, 32 + bob, 1.6);
  p.poly([[28, 25 + bob], [34, 24 + bob], [40, 30 + bob], [34, 30 + bob]], Wt, { dither: .3 });
  p.blob(31.5, 24.5 + bob, 3.4, 3.8, B); p.blob(37.2, 28 + bob, 1.9, 2.2, ramp('#ffe24a'), { dither: .1 }); p.rect(38, 27.4 + bob, .9, 1.9, BLK[0]);
  return p.outline(1).shadow(24, 45, 16, 2.4, 80).done();
}
function crow(f) {
  const p = new Pix(48), B = ramp('#2d2848'), a = (f / WF) * Math.PI * 2, fl = Math.cos(a), bob = fl * -1.5;
  const wing = (dx, dy, s) => { p.poly([[24 + dx, 25 + bob], [10 + dx * .2, 24 - fl * 13 * s + dy + bob], [3 + dx * .2, 30 - fl * 9 * s + dy + bob], [14 + dx * .2, 31 + bob], [26 + dx, 32 + bob]], s > .9 ? B : ramp('#1d1a32'), { dither: .5 }); };
  wing(2, -1, .8); // far wing
  p.poly([[7, 31 + bob], [0, 36 + bob], [4, 40 + bob], [12, 35 + bob]], ramp('#1d1a32'));
  p.blob(22, 30 + bob, 11, 7.6, B); p.blob(22, 33 + bob, 6.5, 4, ramp('#4e4670'), { dither: .6 });
  p.blob(33.5, 25 + bob, 6, 5.6, B); p.poly([[37.5, 23.6 + bob], [46, 26.4 + bob], [37.5, 28.4 + bob]], ramp('#ffc82a'), { dither: .2 });
  p.blob(35.8, 23.4 + bob, 1.8, 1.8, ramp('#fff2a0'), { dither: 0 }); p.rect(36.3, 23 + bob, .9, 1, BLK[0]);
  wing(0, 0, 1);
  p.line(20, 36.5 + bob, 19, 41 + bob, .9, ramp('#c89c20')).line(25, 36.5 + bob, 26, 41 + bob, .9, ramp('#c89c20'));
  return p.outline(1).shadow(24, 46, 9, 2, 55).done();
}
function hedgehog(f) {
  const p = new Pix(48), B = ramp('#7a5a3a'), Q = ramp('#46301c'), QT = ramp('#c9a878'), bob = BOB(f) * .8, cy = CY(f);
  p.blob(14 + cy * 2.4, 41.5, 3.4, 2.8, ramp('#d8b890')).blob(29 - cy * 2.4, 41.5, 3.4, 2.8, ramp('#d8b890'));
  p.blob(20, 31 + bob, 16, 12, Q);
  for (let i = 0; i < 16; i++) { const a = Math.PI + i / 15 * Math.PI * 0.95, x = 20 + Math.cos(a) * 16, y = 31 + bob + Math.sin(a) * 12.5; p.poly([[x - 2.2, y + 2], [x + Math.cos(a) * 5.4, y + Math.sin(a) * 5.4], [x + 2.2, y + 2.4]], i % 2 ? Q : B, { dither: .3 }); p.rect(x + Math.cos(a) * 4.3 - .4, y + Math.sin(a) * 4.3 - .4, 1.4, 1.4, QT[3]); }
  p.blob(20, 34 + bob, 12, 7, B, { dither: .5 });
  p.blob(35.5, 33 + bob, 8.2, 6.6, ramp('#e8c9a0')); p.blob(42.8, 35 + bob, 3.8, 2.8, ramp('#f0d6b4')); p.blob(46, 34.6 + bob, 1.7, 1.5, BLK, { dither: 0 });
  p.blob(31, 27 + bob, 3.2, 3.4, ramp('#d8a880')); p.blob(37.6, 31.6 + bob, 1.6, 1.8, BLK, { dither: 0 }); glint(p, 38, 30.8 + bob, .8);
  p.line(34, 28.6 + bob, 40, 29.6 + bob, .8, Q);
  return p.outline(1).shadow(24, 45, 16, 2.4, 80).done();
}
function hedgeball() {
  const p = new Pix(40), Q = ramp('#46301c'), B = ramp('#7a5a3a');
  p.blob(20, 20, 13, 13, Q);
  for (let i = 0; i < 18; i++) { const a = i / 18 * 6.283, x = 20 + Math.cos(a) * 12, y = 20 + Math.sin(a) * 12; p.poly([[x - Math.sin(a) * 2.6, y + Math.cos(a) * 2.6], [x + Math.cos(a) * 6.5, y + Math.sin(a) * 6.5], [x + Math.sin(a) * 2.6, y - Math.cos(a) * 2.6]], i % 2 ? Q : B, { dither: .3 }); }
  p.blob(20, 20, 10, 10, Q, { dither: .5 }); p.blob(16, 16, 3, 3, B, { dither: .6 });
  return p.outline(1).done();
}
function bombbug(f) {
  const p = new Pix(48), B = ramp('#3e3c52'), R = ramp('#d8402f'), cy = CY(f), bob = BOB(f) * .8;
  for (let i = 0; i < 3; i++) { const x = 15 + i * 6, o = Math.sin((f / WF) * 6.28 + i * 2.1) * 2; p.line(x, 36 + bob, x + o - 3, 43, 1.1, BLK); }
  p.blob(22, 29 + bob, 14.5, 12.5, B); p.blob(18, 22 + bob, 6, 3.5, ramp('#8a88b0'), { dither: .1, bias: .05 });
  p.poly([[8, 31 + bob], [36, 31 + bob], [34, 35 + bob], [10, 35 + bob]], R, { dither: .3 });
  p.blob(36.5, 29.5 + bob, 6, 5.6, ramp('#2b2840'));
  p.blob(38, 28 + bob, 2.4, 2.4, ramp('#ffd640'), { dither: 0 }); p.rect(37, 25.6 + bob, 4, 1, BLK[0]); p.rect(39, 27 + bob, 1.1, 2, BLK[0]);
  p.line(21, 17 + bob, 23, 11 + bob, 1.4, ramp('#b08a50')).line(23, 11 + bob, 28, 8 + bob, 1.2, ramp('#b08a50'));
  p.blob(28.5, 7.5 + bob, 2.2, 2.2, ramp('#ffb020'), { dither: 0 }); p.blob(28.5, 7.5 + bob, 1, 1, ramp('#ffffff'), { dither: 0 });
  return p.outline(1).shadow(24, 44, 14, 2.4, 80).done();
}
// ---------------------------------------------------------------- bosses (authored in 48-space, drawn at 128px)
function hornetQueen(f) {
  const p = new Pix(128, 128, 128 / 48), Y = ramp('#f5b81c'), a = (f / WF) * Math.PI * 2, bob = Math.sin(a) * 1.6, fl = Math.sin(a * 2), W = ramp('#b4e6ff');
  p.poly([[22, 24 + bob], [8, 9 + bob - fl * 3], [26, 7 + bob - fl * 3.5], [30, 22 + bob]], W, { dither: .75 });
  p.poly([[26, 24 + bob], [20, 11 + bob + fl * 3], [36, 12 + bob + fl * 2.6], [34, 24 + bob]], ramp('#e6f6ff'), { dither: .85 });
  p.poly([[11, 28 + bob], [2, 32 + bob], [11, 35 + bob]], ramp('#3a1a2a'), { dither: .2 });
  p.poly([[4, 31.4 + bob], [0.5, 32.4 + bob], [4, 33.2 + bob]], ramp('#ff5040'), { dither: 0 });
  p.blob(17, 30 + bob, 12.6, 9.4, Y);
  for (const x of [11.5, 17, 22.5]) p.blob(x, 30 + bob, 2.2, 8.6, BLK, { dither: .15 });
  p.blob(30, 29 + bob, 8.2, 8, ramp('#d9a010'), { dither: .6 });
  p.blob(38, 29 + bob, 7.4, 7.2, ramp('#3a2418'), { dither: .3 }); p.blob(41, 28 + bob, 3.6, 4, ramp('#ff4a2a'), { dither: .2 }); p.rect(41.4, 26 + bob, 1.4, 1.4, WHITE);
  p.poly([[34, 23.4 + bob], [35.4, 17 + bob], [37.6, 21.6 + bob], [39.8, 15.4 + bob], [41.6, 21.6 + bob], [44, 17 + bob], [44.4, 24 + bob]], ramp('#ffd83a'), { dither: .1 });
  [[37.6, 21.6, ramp('#ff4a6a')], [41.6, 21.8, ramp('#4ad0ff')]].forEach(([x, y, c]) => p.blob(x, y + bob, 1.2, 1.2, c, { dither: 0 }));
  p.poly([[43, 33 + bob], [47, 36.5 + bob], [44, 34.6 + bob]], TEETH, { dither: 0 }).poly([[40.4, 34 + bob], [42, 38 + bob], [41.4, 34 + bob]], TEETH, { dither: 0 });
  p.line(41, 22 + bob, 46, 14 + bob, .8, BLK).line(44, 24 + bob, 47.5, 19 + bob, .8, BLK);
  for (const [x, o] of [[26, 0], [31, 1.6], [35, .6]]) p.line(x, 36 + bob, x - 1.5 + Math.sin(a + o) * 1.4, 43.5 + bob, 1.1, BLK);
  return p.outline(1).shadow(26, 46, 15, 2, 55).done();
}
function moleTitan(f) {
  const p = new Pix(128, 128, 128 / 48), M = ramp('#5c4a6e'), ML = ramp('#8e7aa6'), YEL = ramp('#ffcf30'), cy = CY(f), bob = BOB(f) * .8;
  p.blob(11 - cy * 2, 42, 5.4, 3.4, ramp('#44345a')).blob(27 + cy * 2, 42, 5.4, 3.4, ramp('#44345a'));
  p.blob(20, 29 + bob, 18.8, 14, M); p.blob(22, 35 + bob, 12, 7, ML, { dither: .5 });
  // crystal spines
  [[9, 17, 0], [15, 13, 1], [22, 12, 2], [29, 14, 0]].forEach(([x, y, c], i) => { const C = [ramp('#ff5a7a'), ramp('#5ad0ff'), ramp('#9aff7a')][c]; p.poly([[x - 3, y + 6 + bob], [x + (i % 2 ? -1 : 1), y - 6 + bob], [x + 3, y + 6 + bob]], C, { dither: .15 }); });
  p.blob(36, 29 + bob, 10.8, 9.2, M); p.blob(44, 33 + bob, 4.8, 3.8, PINK);
  for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; p.rect(46.2 + Math.cos(a) * 2.2, 33 + bob + Math.sin(a) * 2.2, .9, .9, PINK[3]); }
  p.blob(39.6, 27 + bob, 3.2, 3.2, ramp('#ff5a3a'), { dither: .1 }); p.blob(39.8, 27 + bob, 1.2, 1.2, BLK, { dither: 0 }); p.rect(38.6, 25.6 + bob, 1, 1, WHITE);
  p.blob(33.5, 20.6 + bob, 10, 5.4, YEL); p.rect(23, 23.6 + bob, 22, 2, YEL[1]); p.blob(42, 19.4 + bob, 3.2, 2.6, ramp('#fff6a0'), { dither: .1 });
  p.rect(30, 14.8 + bob, 4, 4, ramp('#8a8a9a')[2]);
  const ax = 31 + cy * 3, ay = 38 - Math.abs(SN(f)) * 3 + bob;
  p.blob(ax - 6, ay - 1.4, 7.4, 4.8, M); p.blob(ax, ay, 5.4, 4.4, PINK);
  for (let i = 0; i < 3; i++) p.poly([[ax + 3.2, ay - 2.8 + i * 2.8], [ax + 9, ay - 1.8 + i * 2.8], [ax + 3.2, ay - 0.4 + i * 2.8]], TEETH, { dither: .1 });
  return p.outline(1).shadow(24, 46, 21, 2.6, 85).done();
}

export function buildEnemyArt(add, ANIMS) {
  const fr = (pre) => Array.from({ length: WF }, (_, f) => pre + f);
  const mk = (name, fn, rate) => { for (let f = 0; f < WF; f++) add(`${name}_w${f}`, fn(f)); ANIMS.push({ key: `${name}_walk`, frames: fr(`${name}_w`), rate: rate * 2 }); };
  mk('rat', rat, 11); mk('bee', bee, 12); mk('slime', slime, 6); mk('mole', mole, 8); mk('skunk', skunk, 8); mk('crow', crow, 10); mk('hedgehog', hedgehog, 8); mk('bombbug', bombbug, 11);
  mk('hornet', hornetQueen, 9); mk('titan', moleTitan, 5);
  add('hedgeball', hedgeball());
}

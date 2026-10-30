// FX textures (glows, sparks, rings, smoke, flame), projectile art, enemy-shot art and the pixel digit font for damage numbers.
import { Pix, ramp } from './pix.js';
const W = [255, 255, 255], R = (h) => ramp(h);
function cv(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); return { c, w, h, finished: true }; }
const radial = (w, stops) => cv(w, w, (g) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); stops.forEach(([o, a]) => r.addColorStop(o, `rgba(255,255,255,${a})`)); g.fillStyle = r; g.fillRect(0, 0, w, w); });
const GLYPH = { // 5x7 pixel font
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'], 1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'], 2: ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'], 4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'], 5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'], 7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'], 8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'], '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'], '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
};
export const DIGIT_COLORS = { w: '#ffffff', y: '#ffe14a', r: '#ff5a5a', g: '#6dff8a', c: '#7fe8ff', o: '#ff9a3a' };
function glyph(ch, col) {
  return cv(14, 18, (g) => {
    const rows = GLYPH[ch]; g.fillStyle = '#1a1030';
    rows.forEach((row, y) => [...row].forEach((v, x) => { if (v === '1') { for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) g.fillRect(2 + x * 2 + dx * 2, 2 + y * 2 + dy * 2, 2, 2); } }));
    rows.forEach((row, y) => [...row].forEach((v, x) => { if (v === '1') { g.fillStyle = col; g.fillRect(2 + x * 2, 2 + y * 2, 2, 2); g.fillStyle = 'rgba(255,255,255,.35)'; if (y < 3) g.fillRect(2 + x * 2, 2 + y * 2, 2, 1); } }));
  });
}
export function buildFx(add) {
  add('fx_glow', radial(64, [[0, 1], [0.25, 0.55], [0.55, 0.16], [1, 0]]));
  add('fx_glow_sm', radial(32, [[0, 1], [0.35, 0.5], [1, 0]]));
  add('fx_spark', cv(8, 8, (g) => { g.fillStyle = '#fff'; g.fillRect(3, 0, 2, 8); g.fillRect(0, 3, 8, 2); g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(2, 2, 4, 4); }));
  add('fx_dot', cv(4, 4, (g) => { g.fillStyle = '#fff'; g.fillRect(0, 0, 4, 4); }));
  add('fx_star', cv(24, 24, (g) => { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(12, 0); g.lineTo(14, 10); g.lineTo(24, 12); g.lineTo(14, 14); g.lineTo(12, 24); g.lineTo(10, 14); g.lineTo(0, 12); g.lineTo(10, 10); g.closePath(); g.fill(); }));
  add('fx_ring', cv(64, 64, (g) => { g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(32, 32, 29, 0, 7); g.stroke(); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 6; g.beginPath(); g.arc(32, 32, 27, 0, 7); g.stroke(); }));
  add('fx_disc', radial(64, [[0, 0.18], [0.82, 0.28], [0.94, 0.7], [1, 0]]));
  add('fx_beam', cv(64, 16, (g) => { const l = g.createLinearGradient(0, 0, 0, 16); l.addColorStop(0, 'rgba(255,255,255,0)'); l.addColorStop(0.3, 'rgba(255,255,255,.55)'); l.addColorStop(0.5, 'rgba(255,255,255,1)'); l.addColorStop(0.7, 'rgba(255,255,255,.55)'); l.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = l; g.fillRect(0, 0, 64, 16); }));
  add('fx_slash', cv(48, 24, (g) => { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, 22); g.quadraticCurveTo(24, -6, 48, 22); g.quadraticCurveTo(24, 6, 0, 22); g.fill(); }));
  add('fx_flame', cv(16, 24, (g) => { const r = g.createRadialGradient(8, 15, 1, 8, 15, 11); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.5, 'rgba(255,255,255,.7)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.beginPath(); g.moveTo(8, 0); g.quadraticCurveTo(16, 12, 14, 18); g.quadraticCurveTo(8, 26, 2, 18); g.quadraticCurveTo(0, 12, 8, 0); g.fill(); }));
  { const p = new Pix(24); p.blob(12, 12, 10.5, 9.5, R('#ffffff'), { dither: 0.9, bias: 0.15 }); add('fx_smoke', p.done()); }
  { const p = new Pix(10); p.poly([[1, 6], [4, 0], [9, 3], [7, 9], [2, 9]], R('#ffffff'), { dither: .3 }); add('fx_chunk', p.done()); }
  // ---- projectiles
  { const p = new Pix(18); p.blob(9, 10, 6, 6.6, R('#b8864a')); p.blob(9, 5.6, 7, 3.4, R('#6a4a28')); p.rect(8.2, 1, 1.6, 3, [90, 58, 28]); p.blob(7, 9, 1.6, 2, R('#e0b078'), { dither: 0, bias: .1 }); add('pj_nut', p.outline(1).done()); }
  { const p = new Pix(14); p.blob(7, 7, 5.5, 5.5, R('#dff6ff'), { dither: .3 }); p.blob(5.5, 5.5, 2, 2, W && R('#ffffff'), { dither: 0 }); add('pj_snow', p.outline(1).done()); }
  { const p = new Pix(16); p.poly([[3, 4], [2, 0], [7, 2]], R('#e6f6ff'), { dither: .6 }); p.blob(7, 9, 5, 3.6, R('#f5c523')); p.rect(5, 7, 1, 4.4, [43, 36, 48]).rect(8, 7, 1, 4.4, [43, 36, 48]); p.blob(12, 9, 2.6, 2.4, R('#2b2430')); p.rect(2, 9, 1, 1, [43, 36, 48]); add('pj_bee', p.outline(1).done()); }
  { const p = new Pix(28); p.blob(14, 14, 9.5, 9.5, R('#7a5a4a')); p.blob(11, 11, 3, 2.4, R('#d0a890'), { dither: .1, bias: .1 }); p.blob(18, 17, 2.4, 2, R('#4a362c'), { dither: .1 }); p.blob(14, 14, 9.5, 9.5, R('#ff7a2a'), { dither: .95, bias: -.1 }); add('pj_meteor', p.outline(1).done()); }
  { const p = new Pix(22, 16); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; p.poly([[11 + Math.cos(a - .26) * 6, 9 + Math.sin(a - .26) * 4.4], [11 + Math.cos(a) * 10.5, 9 + Math.sin(a) * 7.4], [11 + Math.cos(a + .26) * 6, 9 + Math.sin(a + .26) * 4.4]], R('#a9b4c4')); } p.blob(11, 9, 7, 5, R('#3a3a52')); p.blob(11, 8.4, 2.6, 1.8, R('#ff4a4a'), { dither: .1 }); add('pj_mine', p.outline(1).done()); }
  { const p = new Pix(16, 8); p.poly([[0, 3], [10, 1], [16, 4], [10, 7], [0, 5]], R('#d8f040'), { dither: .2 }); p.rect(0, 3, 6, 1, [255, 255, 200]); add('pj_sting', p.outline(1).done()); }
  { const p = new Pix(24); p.blob(12, 12, 9, 8.4, R('#8a7a6a')); p.blob(9, 9, 3, 2.4, R('#c8b8a8'), { dither: .1, bias: .1 }); p.blob(16, 15, 2.4, 2, R('#5a4a3a'), { dither: .1 }); add('pj_rock', p.outline(1).done()); }
  { const p = new Pix(14, 6); p.poly([[0, 3], [10, 0], [14, 3], [10, 6]], R('#e0c8a0'), { dither: .2 }); add('pj_quill', p.outline(1).done()); }
  { const p = new Pix(22, 18); p.poly([[1, 15], [21, 13], [14, 2]], R('#ffc928')); p.blob(10, 11.4, 1.4, 1.2, R('#b07a0c'), { dither: 0 }); p.blob(15, 11.4, 1, .9, R('#b07a0c'), { dither: 0 }); add('pj_cheese', p.outline(1).done()); }
  { const p = new Pix(12); p.blob(6, 6, 4.6, 4.8, R('#8a5a30')); p.blob(6, 3.4, 5, 2.4, R('#5a3a1c')); add('pj_minin', p.outline(1).done()); }
  { const p = new Pix(30); p.blob(15, 15, 13, 12, R('#62d870'), { dither: .95, bias: -.25 }); p.blob(15, 15, 8, 7, R('#9af0a0'), { dither: .95, bias: -.1 }); add('pj_gas', p.done()); }
  { const p = new Pix(18); p.blob(9, 9, 7, 7, R('#ff6a4a')); p.blob(9, 9, 3.6, 3.6, R('#ffe08a'), { dither: .1 }); add('pj_orb', p.outline(1).done()); }
  { const p = new Pix(30, 16); p.blob(10, 9, 9, 5.4, R('#4a4a62')); p.rect(14, 6, 15, 5, [120, 128, 150]); p.rect(14, 6, 15, 1.4, [170, 180, 200]); p.rect(26, 5, 3, 7, [255, 201, 40]); p.blob(7, 11, 3.6, 3.4, R('#c97c34')); add('cannon', p.outline(1).done()); }
  // ---- digits
  for (const [k, col] of Object.entries(DIGIT_COLORS)) for (const ch of Object.keys(GLYPH)) add(`d_${k}_${ch === '!' ? 'x' : ch === '+' ? 'p' : ch}`, glyph(ch, col));
  // vignette-ish frame for low hp (DOM uses CSS), tiny ground shadow
  add('shadow', cv(32, 12, (g) => { const r = g.createRadialGradient(16, 6, 1, 16, 6, 15); r.addColorStop(0, 'rgba(8,6,20,.55)'); r.addColorStop(1, 'rgba(8,6,20,0)'); g.fillStyle = r; g.save(); g.scale(1, 0.4); g.fillRect(0, 0, 32, 30); g.restore(); }));
}

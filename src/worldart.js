// Procedural pixel-art for the world: trees, rocks, cheese boulders, ruins, crops, fences, landmarks.
// Everything is drawn in code at 2x density (see sprites.js) so it matches the characters. No external assets (no licences needed).
import { Pix, ramp, hex2rgb, clamp } from './pix.js';

export const PROPS = {}; // key -> { w,h (world px), fx,fy (foot origin, world px), col:[[dx,dy,r]...] (colliders relative to the foot), canopy }
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function buildWorldArt(add) {
  const mk = (key, w, h, fx, fy, col, draw, o = {}) => {
    const p = new Pix(w * 2, h * 2, 2); draw(p);
    if (o.outline !== false) p.outline(1);
    if (o.shadow) p.shadow(...o.shadow);
    PROPS[key] = { w, h, fx, fy, col: col || [], canopy: !!o.canopy, ground: !!o.ground, sway: o.sway || 0 };
    add(key, p.done());
  };
  const BARK = ramp('#7a4a2a'), BARKD = ramp('#4a2c1a'), STONE = ramp('#8a8f99'), STONEW = ramp('#a9a49a'), MOSS = ramp('#5f9a48');

  // ---------------------------------------------------------------- trees
  const oak = (i, hex, hexL) => {
    const rnd = rng(31 + i * 7), G = ramp(hex, 6), GL = ramp(hexL, 6);
    mk(`oak${i}`, 64, 76, 32, 70, [[0, 0, 5]], (p) => {
      p.poly([[28, 71], [36, 71], [34.5, 44], [29.5, 44]], BARK, { dither: 0.5 });
      p.line(32, 52, 22, 39, 3, BARK); p.line(32, 49, 43, 37, 3, BARK);
      const bl = [];
      for (let k = 0; k < 9; k++) { const a = k / 9 * 6.283 + rnd() * 0.5, rr = 11 + rnd() * 6; bl.push([32 + Math.cos(a) * rr * 1.15, 30 + Math.sin(a) * rr * 0.8, 9.5 + rnd() * 4]); }
      bl.sort((a, b) => b[1] - a[1]).forEach(([x, y, r]) => p.blob(x, y, r, r * 0.92, G, { bias: -0.05 }));
      p.blob(32, 26, 13, 11, G, { bias: 0.02 });
      for (let k = 0; k < 6; k++) p.blob(20 + rnd() * 22, 13 + rnd() * 14, 4 + rnd() * 3, 3 + rnd() * 2, GL, { bias: -0.12, dither: 0.7 });
      for (let k = 0; k < 14; k++) p.rect(14 + rnd() * 36, 14 + rnd() * 30, 2, 1, G[1]);
    }, { canopy: true, shadow: [32, 70, 17, 4.5, 80] });
  };
  oak(0, '#3f9a43', '#7ad05a'); oak(1, '#348a3e', '#6cc455'); oak(2, '#4aa648', '#8fdc62'); oak(3, '#5f9a3a', '#c4e070'); // last: olive/yellowish
  oak(4, '#d9822b', '#ffc24a'); oak(5, '#c4452f', '#ff9a52'); oak(6, '#e0a62e', '#fff07a'); // autumn
  const pine = (i, hex) => {
    const rnd = rng(77 + i * 13), G = ramp(hex, 6);
    mk(`pine${i}`, 44, 84, 22, 78, [[0, 0, 4]], (p) => {
      p.poly([[19, 79], [25, 79], [24, 58], [20, 58]], BARK);
      const tiers = 5 + (i % 2);
      for (let t = 0; t < tiers; t++) {
        const y0 = 66 - t * 11.5, w = (19 - t * 2.9) * (0.92 + rnd() * 0.16);
        p.poly([[22, y0 - 16], [22 - w, y0 + 2], [22 - w * 0.55, y0 - 0.5], [22 - w * 0.2, y0 + 3], [22 + w * 0.25, y0 - 0.5], [22 + w * 0.6, y0 + 3], [22 + w, y0 + 2]], G, { dither: 0.55 });
        p.line(22 - w * 0.7, y0 + 0.5, 22 + w * 0.7, y0 + 0.5, 1.2, ramp(hex, 4));
      }
    }, { canopy: true, shadow: [22, 78, 12, 3.6, 80] });
  };
  pine(0, '#2f7a55'); pine(1, '#276a4a'); pine(2, '#3a8a5a');
  const dead = (i) => {
    const rnd = rng(900 + i); mk(`dead${i}`, 56, 66, 28, 62, [[0, 0, 4]], (p) => {
      p.poly([[25, 62], [31, 62], [29.5, 30], [26.5, 30]], BARKD, { dither: 0.6 });
      const br = (x, y, a, l, w, d) => { const x2 = x + Math.cos(a) * l, y2 = y + Math.sin(a) * l; p.line(x, y, x2, y2, w, BARKD); if (d > 0) { br(x2, y2, a - 0.5 - rnd() * 0.3, l * 0.7, w * 0.7, d - 1); br(x2, y2, a + 0.5 + rnd() * 0.3, l * 0.65, w * 0.7, d - 1); } };
      br(28, 40, -2.2 - rnd() * 0.3, 14, 2.6, 2); br(28, 36, -0.9 + rnd() * 0.3, 15, 2.6, 2); br(28, 32, -1.57, 12, 2.2, 2);
    }, { canopy: false, shadow: [28, 62, 11, 3, 70] });
  };
  dead(0); dead(1);
  const bush = (i, hex, berry) => {
    const rnd = rng(500 + i), G = ramp(hex, 6);
    mk(`bush${i}`, 30, 22, 15, 19, [], (p) => {
      p.blob(9, 13, 8, 7, G).blob(21, 13, 8, 7, G).blob(15, 10, 9, 8, G, { bias: 0.04 }); p.blob(12, 7, 4, 3, ramp(hex, 5), { bias: 0.25, dither: 0.5 });
      if (berry) for (let k = 0; k < 6; k++) p.blob(8 + rnd() * 15, 7 + rnd() * 9, 1.3, 1.3, ramp(berry), { dither: 0.1 });
    }, { shadow: [15, 19, 12, 2.6, 70] });
  };
  bush(0, '#3d9440'); bush(1, '#2f7a3a'); bush(2, '#5fa83e'); bush(3, '#3d9440', '#e63b5a'); bush(4, '#2f7a3a', '#6aa6ff');

  // ---------------------------------------------------------------- stones
  const boulder = (key, w, h, rx, ry, seed, col, mossy, shade = '#8a8f99') => {
    const rnd = rng(seed), R = ramp(shade, 6);
    mk(key, w, h, w / 2, h - 4, col, (p) => {
      const cx = w / 2, cy = h - 4 - ry * 0.85;
      p.blob(cx, cy, rx, ry, R); p.blob(cx - rx * 0.45, cy + ry * 0.2, rx * 0.55, ry * 0.7, R); p.blob(cx + rx * 0.45, cy + ry * 0.25, rx * 0.5, ry * 0.65, R, { bias: -0.05 });
      p.blob(cx - rx * 0.25, cy - ry * 0.45, rx * 0.45, ry * 0.35, ramp('#cfd6de', 4), { dither: 0.5, bias: 0.1 });
      for (let k = 0; k < 2; k++) { const x = cx - rx * 0.4 + rnd() * rx * 0.9, y = cy - ry * 0.1 + rnd() * ry * 0.6; p.line(x, y, x + 3 + rnd() * 3, y + 3 + rnd() * 3, 0.8, ramp('#4a4f5a')); }
      if (mossy) { p.blob(cx - rx * 0.1, cy - ry * 0.8, rx * 0.6, ry * 0.3, MOSS, { dither: 0.5 }); p.blob(cx + rx * 0.5, cy - ry * 0.1, rx * 0.25, ry * 0.3, MOSS, { dither: 0.5 }); }
    }, { shadow: [w / 2, h - 3, rx * 0.95, 2.4, 75] });
  };
  boulder('rock_s0', 22, 14, 8, 5, 1, [], false); boulder('rock_s1', 22, 14, 8, 5.4, 2, [], true); boulder('rock_s2', 20, 13, 7, 4.8, 3, [], false, '#9a9484');
  boulder('rock_m0', 36, 28, 14, 10, 4, [[0, 0, 9]], true); boulder('rock_m1', 36, 28, 14, 10.5, 5, [[0, 0, 9]], false); boulder('rock_m2', 34, 26, 13, 9.5, 6, [[0, 0, 8.5]], false, '#9a9484');
  boulder('rock_l0', 64, 48, 28, 19, 7, [[-12, -3, 13], [11, -2, 13]], true); boulder('rock_l1', 60, 46, 26, 18, 8, [[-11, -3, 12], [10, -2, 12]], false, '#8f8a82');

  // ---------------------------------------------------------------- cheese (SW badlands)
  const CH = ramp('#f0bf3a', 6), CHD = ramp('#c98a1e', 5);
  const holes = (p, rnd, cx, cy, rx, ry, n, rmax) => { for (let k = 0; k < n; k++) { const a = rnd() * 6.28, d = Math.sqrt(rnd()), x = cx + Math.cos(a) * rx * d * 0.8, y = cy + Math.sin(a) * ry * d * 0.8, r = 1.2 + rnd() * rmax; p.blob(x, y, r, r * 0.8, CHD, { dither: 0.1, bias: -0.1 }); p.blob(x - r * 0.25, y - r * 0.25, r * 0.5, r * 0.4, ramp('#f9de7b', 3), { dither: 0, bias: 0.4 }); } };
  const cheeseBoulder = (key, w, h, rx, ry, seed, col) => {
    const rnd = rng(seed);
    mk(key, w, h, w / 2, h - 4, col, (p) => {
      const cx = w / 2, cy = h - 4 - ry * 0.85;
      p.blob(cx, cy, rx, ry, CH); p.blob(cx - rx * 0.4, cy + ry * 0.2, rx * 0.6, ry * 0.7, CH); p.blob(cx + rx * 0.45, cy + ry * 0.2, rx * 0.5, ry * 0.7, CH, { bias: -0.04 });
      p.blob(cx - rx * 0.25, cy - ry * 0.45, rx * 0.5, ry * 0.32, ramp('#fff1a8', 4), { dither: 0.5, bias: 0.12 });
      holes(p, rnd, cx, cy + ry * 0.1, rx, ry, Math.round(rx / 2.2), 2.4 + rx / 14);
    }, { shadow: [w / 2, h - 3, rx * 0.95, 2.6, 70] });
  };
  cheeseBoulder('cheese_s0', 24, 17, 9, 6, 11, []); cheeseBoulder('cheese_s1', 22, 16, 8, 5.6, 12, []);
  cheeseBoulder('cheese_m0', 40, 30, 16, 11, 13, [[0, 0, 10]]); cheeseBoulder('cheese_m1', 38, 29, 15, 10.5, 14, [[0, 0, 9.5]]);
  cheeseBoulder('cheese_l0', 70, 52, 30, 21, 15, [[-13, -3, 14], [12, -2, 14]]); cheeseBoulder('cheese_l1', 64, 48, 28, 19, 16, [[-12, -3, 13], [11, -2, 13]]);
  const wedge = (key, seed, flip) => { // cheese wedge lying on the ground
    const rnd = rng(seed);
    mk(key, 34, 24, 17, 21, [[0, -2, 8]], (p) => {
      p.poly([[3, 14], [17, 5], [31, 12], [17, 18]], ramp('#ffd95a', 5), { dither: 0.3 });        // top
      p.poly([[3, 14], [17, 18], [17, 21], [3, 17]], CHD, { dither: 0.2 });                        // left side
      p.poly([[31, 12], [17, 18], [17, 21], [31, 15]], ramp('#b87818', 5), { dither: 0.2 });       // right side
      holes(p, rnd, 18, 12, 10, 4, 3, 1.4);
    }, { shadow: [17, 21, 14, 2.2, 70] });
  };
  wedge('wedge0', 21); wedge('wedge1', 22);
  mk('cheese_wheel', 112, 92, 56, 84, [[-34, -8, 17], [0, -4, 18], [34, -8, 17], [-18, -22, 15], [18, -22, 15], [0, -26, 15]], (p) => {
    const rnd = rng(7);
    p.blob(56, 66, 48, 17, ramp('#d99a22', 6), { bias: -0.05 });   // bottom rim
    p.slab(8, 40, 96, 26, ramp('#e5a62c', 6));                     // side
    p.blob(56, 40, 48, 17, ramp('#ffd350', 6), { bias: 0.1 });     // top face
    p.clearEllipse(104, 52, 15, 17);                               // a bite taken out
    p.blob(90, 50, 6, 8, ramp('#fff0a0', 4), { dither: 0.3, bias: 0.1 });
    holes(p, rnd, 40, 40, 38, 12, 9, 2.8); holes(p, rnd, 40, 54, 38, 6, 7, 2.4);
    p.blob(24, 34, 12, 3, ramp('#fff6b8', 4), { dither: 0.6, bias: 0.2 });
  }, { shadow: [56, 82, 50, 6, 60] });

  // ---------------------------------------------------------------- hamster wheel ruins
  mk('wheel_ruin', 136, 128, 68, 118, [[-48, -4, 11], [48, -4, 11], [-34, -12, 8], [34, -12, 8]], (p) => {
    const rnd = rng(3), WOOD = ramp('#b98a4e', 6), RING = ramp('#9aa0a8', 6);
    // pedestals
    p.slab(14, 96, 24, 22, STONEW); p.slab(98, 96, 24, 22, STONEW); p.slab(10, 112, 32, 8, STONE); p.slab(94, 112, 32, 8, STONE);
    // ring (donut)
    const cx = 68, cy = 58, R0 = 54, R1 = 43;
    p.blob(cx, cy, R0, R0, RING, { dither: 0.5 }); p.blob(cx, cy, R0 - 3, R0 - 3, ramp('#b4bac2', 5), { dither: 0.7, bias: 0.05 });
    p.clearEllipse(cx, cy, R1, R1);
    // inner lip (slight depth)
    for (let a = 0; a < 6.283; a += 0.035) { const x = cx + Math.cos(a) * (R1 + 0.6), y = cy + Math.sin(a) * (R1 + 0.6); p.rect(x, y, 1.2, 1.2, hex2rgb(a > 3.14 ? '#cfd5dc' : '#5c6270')); }
    // wooden rungs
    for (let k = 0; k < 14; k++) { const a = k / 14 * 6.283 + 0.1; if (k === 3 || k === 4 || k === 9) continue; p.line(cx + Math.cos(a) * R1, cy + Math.sin(a) * R1, cx + Math.cos(a + 0.0) * 8, cy + Math.sin(a) * 8, 2, WOOD); }
    // spokes missing -> broken stubs
    [3, 4, 9].forEach((k) => { const a = k / 14 * 6.283 + 0.1; p.line(cx + Math.cos(a) * R1, cy + Math.sin(a) * R1, cx + Math.cos(a) * (R1 - 11 + rnd() * 5), cy + Math.sin(a) * (R1 - 11), 2, WOOD); });
    p.blob(cx, cy, 8, 8, ramp('#8a6a3a', 6)); p.blob(cx, cy, 4, 4, ramp('#d8b26a', 4), { dither: 0.3 });  // axle
    // broken gaps in the ring
    p.clearEllipse(cx + 38, cy - 40, 10, 8); p.clearEllipse(cx - 46, cy + 22, 8, 9); p.clearEllipse(cx + 12, cy + 52, 7, 5);
    // moss + vines
    [[cx - 20, cy - 52, 14, 4], [cx + 46, cy + 8, 5, 12], [cx - 50, cy - 8, 4, 14], [cx + 22, cy + 48, 12, 4]].forEach(([x, y, rx, ry]) => p.blob(x, y, rx, ry, MOSS, { dither: 0.7 }));
    // rubble at the base
    [[8, 118, 6, 4], [40, 120, 7, 4], [96, 120, 7, 4], [128, 118, 6, 4], [68, 122, 8, 3.5]].forEach(([x, y, rx, ry]) => p.blob(x, y, rx, ry, STONE));
  }, { canopy: false, shadow: [68, 122, 60, 5, 70] });
  const pillar = (i, hh, broken) => mk(`pillar${i}`, 24, hh + 10, 12, hh + 6, [[0, 0, 6]], (p) => {
    const rnd = rng(60 + i);
    p.slab(5, hh + 2, 14, 5, STONE); p.slab(7, 6 + (broken ? 8 : 0), 10, hh - 4 - (broken ? 8 : 0), STONEW);
    if (!broken) p.slab(4, 2, 16, 6, STONE);
    if (broken) { p.poly([[7, 14], [12, 8], [14, 13], [17, 7], [17, 14]], STONEW, { dither: 0.4 }); p.clearEllipse(12, 10, 4, 3); }
    for (let k = 0; k < 3; k++) p.line(9 + rnd() * 6, 14 + rnd() * (hh - 14), 9 + rnd() * 6, 18 + rnd() * (hh - 18), 0.7, ramp('#4a4f5a'));
    p.blob(10, hh - 6, 5, 4, MOSS, { dither: 0.6 });
  }, { shadow: [12, hh + 6, 11, 2.4, 70] });
  pillar(0, 40, false); pillar(1, 30, true); pillar(2, 22, true);
  mk('ruinwall', 56, 30, 28, 26, [[-18, -2, 7], [-6, -2, 7], [6, -2, 7], [18, -2, 7]], (p) => {
    const rnd = rng(81);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { if (r === 0 && (c === 1 || c === 2) && rnd() > 0.4) continue; p.slab(2 + c * 13 + (r % 2) * 6, 4 + r * 7 + (r === 0 ? 4 : 0), 12, 7, rnd() > 0.5 ? STONEW : STONE); }
    p.blob(14, 8, 6, 2.4, MOSS, { dither: 0.7 }); p.blob(40, 14, 5, 2, MOSS, { dither: 0.7 });
  }, { shadow: [28, 26, 26, 2.4, 70] });
  mk('arch', 64, 62, 32, 58, [[-22, 0, 6.5], [22, 0, 6.5]], (p) => {
    p.slab(8, 10, 12, 46, STONEW); p.slab(44, 10, 12, 46, STONEW); p.slab(5, 52, 18, 6, STONE); p.slab(41, 52, 18, 6, STONE);
    p.poly([[8, 12], [14, 2], [32, 0], [38, 6], [34, 12], [20, 10]], STONE, { dither: 0.4 }); p.poly([[44, 12], [52, 6], [56, 12]], STONE, { dither: 0.4 });
    p.blob(32, 4, 7, 2.4, MOSS, { dither: 0.7 }); p.blob(12, 40, 3, 8, MOSS, { dither: 0.7 });
  }, { shadow: [32, 58, 28, 3, 70], canopy: false });

  // ---------------------------------------------------------------- Squeekchain landmarks
  mk('obelisk', 30, 84, 15, 78, [[0, 0, 8]], (p) => {
    const S = ramp('#5b6275', 6), GOLD = ramp('#ffd23f', 5);
    p.slab(3, 70, 24, 8, ramp('#707a90', 5)); p.slab(6, 64, 18, 8, S);
    p.poly([[8, 66], [22, 66], [20, 12], [15, 3], [10, 12]], S, { dither: 0.4 });
    p.poly([[15, 3], [20, 12], [10, 12]], GOLD, { dither: 0.2 });
    for (let k = 0; k < 5; k++) { p.rect(13, 18 + k * 9, 4, 2, hex2rgb('#ffd23f')); p.rect(11 + (k % 2) * 6, 22 + k * 9, 2, 2, hex2rgb('#ffe88a')); }
    p.line(11, 14, 11, 60, 0.8, ramp('#8892aa'));
  }, { shadow: [15, 78, 15, 3.4, 80] });
  mk('blockmon', 44, 56, 22, 52, [[0, 0, 13]], (p) => {
    const G = ramp('#ffd23f', 6);
    p.slab(4, 40, 36, 12, ramp('#707a90', 5)); p.slab(8, 34, 28, 8, ramp('#5b6275', 5));
    p.poly([[22, 6], [38, 14], [22, 22], [6, 14]], ramp('#ffe88a', 5), { dither: 0.3 });
    p.poly([[6, 14], [22, 22], [22, 38], [6, 30]], G, { dither: 0.3 }); p.poly([[38, 14], [22, 22], [22, 38], [38, 30]], ramp('#c99a1e', 5), { dither: 0.3 });
    p.line(22, 22, 22, 38, 0.8, ramp('#8a5a10')); p.line(6, 14, 22, 22, 0.8, ramp('#8a5a10')); p.line(38, 14, 22, 22, 0.8, ramp('#8a5a10'));
    p.blob(14, 26, 3, 3, ramp('#fff6b8', 3), { dither: 0, bias: 0.3 }); p.blob(30, 26, 2, 2, ramp('#8a5a10', 3), { dither: 0 });
  }, { shadow: [22, 52, 21, 3.4, 80] });
  const menhir = (i, hh) => mk(`menhir${i}`, 22, hh + 8, 11, hh + 4, [[0, 0, 6]], (p) => {
    const rnd = rng(40 + i), S = ramp('#7a8090', 6);
    p.poly([[4, hh + 3], [18, hh + 3], [17, 10], [13, 2], [7, 4], [5, 12]], S, { dither: 0.4 });
    p.line(11, 12, 11, 14 + hh * 0.3, 1, ramp('#ffd23f')); p.line(8, 18, 14, 18, 1, ramp('#ffd23f'));
    p.blob(8, hh, 5, 3, MOSS, { dither: 0.6 }); p.blob(14, 8, 3, 1.8, MOSS, { dither: 0.7 });
  }, { shadow: [11, hh + 4, 9, 2.2, 70] });
  menhir(0, 30); menhir(1, 24); menhir(2, 34);
  mk('signpost', 28, 40, 14, 37, [[0, 0, 3.5]], (p) => {
    p.slab(12, 8, 4, 30, ramp('#8a5a2a', 5)); p.poly([[4, 8], [22, 8], [26, 12], [22, 16], [4, 16]], ramp('#c9904f', 5), { dither: 0.3 }); p.poly([[24, 18], [6, 18], [2, 22], [6, 26], [24, 26]], ramp('#b07a3e', 5), { dither: 0.3 });
    p.rect(7, 11, 10, 1.2, hex2rgb('#4a2c1a')); p.rect(9, 21, 10, 1.2, hex2rgb('#4a2c1a'));
  }, { shadow: [14, 37, 8, 2, 70] });

  // ---------------------------------------------------------------- farm
  mk('haystack', 38, 34, 19, 31, [[0, 0, 11]], (p) => {
    const H = ramp('#e6c04a', 6); p.blob(19, 20, 16, 12, H); p.blob(19, 12, 11, 8, H, { bias: 0.06 });
    for (let k = 0; k < 8; k++) p.line(8 + k * 3, 14 + (k % 3) * 4, 10 + k * 3, 24 + (k % 2) * 3, 0.7, ramp('#a47a1e')); p.blob(14, 9, 4, 2.4, ramp('#fff0a0', 4), { dither: 0.6, bias: 0.2 });
    p.line(5, 22, 33, 22, 1, ramp('#b83a2a'));
  }, { shadow: [19, 31, 16, 2.8, 70] });
  mk('scarecrow', 30, 52, 15, 49, [[0, 0, 4]], (p) => {
    p.slab(13, 14, 4, 34, ramp('#8a5a2a', 5)); p.slab(3, 20, 24, 3.5, ramp('#8a5a2a', 5));
    p.blob(15, 28, 7, 8, ramp('#5b78b8', 6)); p.blob(15, 28, 3, 3, ramp('#d9c070', 4), { dither: 0.3 });
    p.blob(15, 12, 6, 6, ramp('#e6c68a', 6)); p.poly([[6, 9], [24, 9], [20, 2], [10, 2]], ramp('#8a5a2a', 5)); p.slab(4, 8, 22, 3, ramp('#6a4420', 5));
    p.rect(12, 11, 1.4, 1.4, [30, 20, 20]); p.rect(17, 11, 1.4, 1.4, [30, 20, 20]); p.line(12.5, 15, 17.5, 15, 0.8, ramp('#2a1a1a'));
    for (let k = 0; k < 4; k++) { p.line(3 + k, 21, 0 + k, 27 + k, 1, ramp('#e6c04a')); p.line(27 - k, 21, 30 - k, 27 + k, 1, ramp('#e6c04a')); }
    p.blob(24, 8, 2, 2, ramp('#ff6b6b', 4), { dither: 0 });
  }, { shadow: [15, 49, 9, 2, 70] });
  mk('fence_h', 28, 20, 14, 17, [[-9, 0, 4], [0, 0, 4], [9, 0, 4]], (p) => {
    const W = ramp('#b98a4e', 5);
    p.slab(2, 6, 4, 11, W); p.slab(22, 6, 4, 11, W); p.slab(0, 8, 28, 2.6, W); p.slab(0, 12.5, 28, 2.6, W);
  }, { shadow: [14, 17, 13, 1.8, 60] });
  mk('fence_v', 12, 22, 6, 19, [[0, 0, 4]], (p) => {
    const W = ramp('#b98a4e', 5);
    p.slab(4, 4, 4, 15, W); p.slab(1, 8, 10, 2.2, W); p.slab(1, 12.5, 10, 2.2, W); p.poly([[4, 4], [8, 4], [6, 1.5]], W, { dither: 0.3 });
  }, { shadow: [6, 19, 5, 1.6, 60] });
  const sunflower = (i) => mk(`sunflower${i}`, 22, 40, 11, 38, [], (p) => {
    const rnd = rng(210 + i), PET = ramp('#ffd23f', 5);
    p.line(11, 38, 11 + (i ? 1 : -1), 16, 1.6, ramp('#3f8a3a')); p.blob(5, 28, 5, 2.4, ramp('#4aa044', 5), { dither: 0.3 }); p.blob(17, 24, 5, 2.4, ramp('#4aa044', 5), { dither: 0.3 });
    for (let k = 0; k < 10; k++) { const a = k / 10 * 6.283; p.blob(11 + Math.cos(a) * 6.4, 12 + Math.sin(a) * 6.4, 3.4, 2.2, PET, { dither: 0.2 }); }
    p.blob(11, 12, 4.6, 4.6, ramp('#6a3a1a', 5), { dither: 0.3 }); p.blob(10, 11, 1.8, 1.4, ramp('#a8682a', 3), { dither: 0, bias: 0.2 });
  }, { shadow: [11, 38, 6, 1.6, 55], sway: 1 });
  sunflower(0); sunflower(1);
  const wheat = (i) => mk(`wheat${i}`, 22, 28, 11, 26, [], (p) => {
    const rnd = rng(310 + i), W = ramp('#e6c04a', 5);
    for (let k = 0; k < 7; k++) { const x = 3 + k * 2.6, h = 14 + rnd() * 7, lean = (rnd() - 0.5) * 4; p.line(x, 26, x + lean, 26 - h, 1, ramp('#9aa84a', 4)); p.blob(x + lean, 26 - h - 2, 1.4, 3.4, W, { dither: 0.1 }); }
  }, { shadow: [11, 26, 8, 1.4, 45], sway: 1 });
  wheat(0); wheat(1);

  // ---------------------------------------------------------------- forest / water extras
  const shroom = (i, cap) => mk(`mush${i}`, 24, 26, 12, 24, i < 2 ? [[0, 0, 4]] : [], (p) => {
    const C = ramp(cap, 5); p.slab(9, 14, 6, 10, ramp('#f4e8d0', 4)); p.blob(12, 12, 10, 7.5, C);
    p.blob(8, 9, 2.2, 1.6, ramp('#ffffff', 3), { dither: 0, bias: 0.3 }); p.blob(15, 10, 1.8, 1.4, ramp('#ffffff', 3), { dither: 0, bias: 0.3 }); p.blob(12, 6.6, 1.6, 1.1, ramp('#ffffff', 3), { dither: 0, bias: 0.3 });
  }, { shadow: [12, 24, 8, 1.8, 60] });
  shroom(0, '#d8353f'); shroom(1, '#e08a2f'); shroom(2, '#b04ad0');
  const log = (i) => mk(`log${i}`, 52, 22, 26, 19, [[-16, 0, 6], [0, 0, 6], [16, 0, 6]], (p) => {
    const B = ramp('#8a5a2a', 6); p.line(8, 12, 44, 12, 11, B); p.blob(8, 12, 5.4, 5.6, ramp('#d8b070', 5), { dither: 0.3 }); p.blob(8, 12, 3, 3.2, ramp('#a87a40', 5), { dither: 0.2 }); p.blob(8, 12, 1, 1.1, ramp('#d8b070', 3), { dither: 0 });
    p.blob(30, 7, 7, 2.2, MOSS, { dither: 0.6 }); for (let k = 0; k < 5; k++) p.line(14 + k * 7, 8, 16 + k * 7, 16, 0.6, ramp('#5a3a1a'));
  }, { shadow: [26, 19, 22, 2.6, 70] });
  log(0); log(1);
  mk('stump', 20, 20, 10, 17, [[0, 0, 5]], (p) => { p.slab(3, 6, 14, 11, ramp('#8a5a2a', 5)); p.blob(10, 6, 7, 3.2, ramp('#d8b070', 5), { dither: 0.3 }); p.blob(10, 6, 3.6, 1.6, ramp('#a87a40', 5), { dither: 0.2 }); }, { shadow: [10, 17, 8, 1.8, 65] });
  const reed = (i) => mk(`reed${i}`, 24, 34, 12, 31, [], (p) => {
    const rnd = rng(400 + i), G = ramp('#4f9a4a', 5);
    for (let k = 0; k < 5; k++) { const x = 4 + k * 3.8, h = 16 + rnd() * 12, lean = (rnd() - 0.5) * 5; p.line(x, 31, x + lean, 31 - h, 1.1, G); if (k % 2 === i % 2) p.blob(x + lean, 31 - h + 1, 1.8, 4.4, ramp('#7a4a2a', 4), { dither: 0.1 }); }
  }, { shadow: [12, 31, 8, 1.6, 40], sway: 1 });
  reed(0); reed(1);
  const lily = (i, flower) => mk(`lily${i}`, 18, 10, 9, 5, [], (p) => {
    p.blob(9, 5, 7.6, 3.6, ramp('#4aa044', 5), { dither: 0.3 }); p.clear(9, 3.6, 9, 1.4); p.line(4, 4, 8, 5, 0.6, ramp('#2f7a3a'));
    if (flower) { p.blob(8, 3.5, 2.6, 1.8, ramp('#ff9fc0', 5), { dither: 0.2 }); p.blob(8, 3.2, 1, 0.8, ramp('#ffe066', 3), { dither: 0 }); }
  }, { outline: false, ground: true });
  lily(0, false); lily(1, true);
  // tiny effects
  { const p = new Pix(8, 8, 1); p.rect(3, 0, 2, 8, [255, 255, 255]); p.rect(0, 3, 8, 2, [255, 255, 255]); p.rect(2, 2, 4, 4, [210, 240, 255]); add('sparkle', p.done()); }
  { const p = new Pix(96, 96, 1); const px = p.d; for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) { const d = Math.hypot(x - 47.5, y - 47.5) / 48; const a = Math.pow(clamp(1 - d), 2.2); const i = (y * 96 + x) * 4; px[i] = 255; px[i + 1] = 220; px[i + 2] = 90; px[i + 3] = Math.round(a * 255); } add('glow', p.done()); }
  { const p = new Pix(24, 12, 1); for (let y = 0; y < 12; y++) for (let x = 0; x < 24; x++) { const d = Math.hypot((x - 11.5) / 12, (y - 5.5) / 6); p._set(x, y, [0, 0, 0], Math.round(clamp(1 - d) * 120)); } add('blobshadow', p.done()); }
}

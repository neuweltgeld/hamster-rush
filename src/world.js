// The Hamster Rush world: a 2048x1536 handcrafted-feeling map generated from a fixed seed.
//  - material map (grass / forest / leaf litter / dry grass / cheese / dirt / soil / sprouts / cobble / water / mud / flowers)
//  - biomes: meadow, hamster-wheel ruins, forests, pond, seed farm, cheese badlands, tree rim
//  - paths (Catmull-Rom splines), landmarks, ~2k props placed on a jittered grid with clump noise (no repeating tiles)
//  - ground baked into 128px chunks (canvas textures), painted on demand / in idle time
//  - circle colliders in a spatial hash, tree-canopy fade
// All art is original and generated in code: no external tileset, no third-party licence.
import { PROPS, rng } from './worldart.js';
import { hex2rgb } from './pix.js';

export const WW = 2048, WH = 1536, CELL = 2, CW = WW / CELL, CH = WH / CELL;
export const START = { x: 1024, y: 830 };
export const CHUNK = 128, CHT = CHUNK * 2; // chunk size in world px / texels
export const M = { GRASS: 0, FOREST: 1, LEAF: 2, DRY: 3, CHEESE: 4, DIRT: 5, SOIL: 6, SPROUT: 7, COBBLE: 8, DEEP: 9, SHALLOW: 10, MUD: 11, FLOWERS: 12 };
export const B = { MEADOW: 0, FOREST: 1, RUINS: 2, POND: 3, FARM: 4, CHEESE: 5, RIM: 6 };

// ---------------------------------------------------------------- noise
const NT = new Float32Array(65536); { const r = rng(20261030); for (let i = 0; i < NT.length; i++) NT[i] = r(); }
function vn(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const x0 = xi & 255, x1 = (xi + 1) & 255, y0 = (yi & 255) << 8, y1 = ((yi + 1) & 255) << 8;
  const a = NT[y0 | x0], b = NT[y0 | x1], c = NT[y1 | x0], d = NT[y1 | x1];
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, o = 3) => { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < o; i++) { s += vn(x * f + i * 17.3, y * f - i * 9.1) * a; n += a; a *= 0.5; f *= 2; } return s / n; };
const hash2 = (x, y) => { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; };

// ---------------------------------------------------------------- palettes (dark -> light)
const PAL = {
  [M.GRASS]: ['#356f34', '#3e7f3a', '#478c40', '#519a47', '#5ca84f'],
  [M.FOREST]: ['#244f2f', '#2c5f36', '#346e3c', '#3d7c43', '#478a4a'],
  [M.LEAF]: ['#5b3f25', '#6a4a2b', '#7a5732', '#8b6539', '#9d7442'],
  [M.DRY]: ['#737f37', '#818c3f', '#909948', '#a0a552', '#b0b25f'],
  [M.CHEESE]: ['#c18f24', '#cf9e2b', '#dcad34', '#e8bc3f', '#f3ca50'],
  [M.DIRT]: ['#654529', '#714e30', '#7e5937', '#8a643f', '#977047'],
  [M.SOIL]: ['#432a1b', '#4f3322', '#5b3c2a', '#664633', '#73513b'],
  [M.MUD]: ['#493a26', '#55432d', '#614e35', '#6d593e', '#7a6547'],
  [M.DEEP]: ['#1a4780', '#1f5290', '#255e9c', '#2c6aa8', '#3576b3'],
  [M.SHALLOW]: ['#3a8ac2', '#459acd', '#53a9d8', '#66b8e1', '#7fc8ec'],
};
PAL[M.FLOWERS] = PAL[M.GRASS]; PAL[M.SPROUT] = PAL[M.SOIL];
const toU32 = (hex) => { const [r, g, b] = hex2rgb(hex); return (255 << 24) | (b << 16) | (g << 8) | r; };
const PALU = {}; for (const k in PAL) PALU[k] = PAL[k].map(toU32);
const COB = ['#565c69', '#656c7a', '#747c8b', '#848c9b', '#959dab'].map(toU32), MORTAR = toU32('#3b3f4a'), MOSSU = ['#4a7f3e', '#5a9448'].map(toU32);
const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

// ---------------------------------------------------------------- layout data
const centres = [ // biome, x, y, radius (bigger = bigger region)
  [B.MEADOW, 1024, 830, 330], [B.MEADOW, 1000, 1340, 300], [B.MEADOW, 300, 800, 210], [B.MEADOW, 1250, 650, 190],
  [B.RUINS, 1024, 520, 190],
  [B.FOREST, 1620, 340, 360], [B.FOREST, 1880, 690, 190], [B.FOREST, 760, 190, 230],
  [B.POND, 440, 440, 235],
  [B.FARM, 1500, 1010, 255],
  [B.CHEESE, 430, 1210, 330],
];
const ponds = [{ x: 410, y: 430, rx: 175, ry: 120 }, { x: 500, y: 515, rx: 95, ry: 68 }, { x: 330, y: 360, rx: 90, ry: 70 }, { x: 1590, y: 1300, rx: 92, ry: 58 }];
const plots = [ // seed farm
  { x: 1300, y: 880, w: 140, h: 90, kind: 'wheat' }, { x: 1480, y: 880, w: 140, h: 90, kind: 'sprout' },
  { x: 1300, y: 1050, w: 140, h: 90, kind: 'sun' }, { x: 1480, y: 1050, w: 140, h: 90, kind: 'wheat2' },
];
const SPLINES = [
  [[1024, 530], [1030, 680], [1024, 830], [1150, 935], [1330, 1000], [1500, 1005], [1700, 1005]],
  [[1024, 830], [900, 980], [720, 1085], [540, 1170]],
  [[1024, 530], [900, 500], [770, 520], [660, 520]],
  [[1024, 520], [1200, 470], [1400, 420], [1600, 400]],
  [[1024, 520], [1010, 380], [1024, 250], [1040, 120]],
  [[1024, 830], [850, 805], [700, 780]],
  [[540, 1170], [500, 960], [485, 740], [560, 610], [660, 520]],
  [[1700, 1005], [1790, 880], [1800, 690]],
];
const RUIN_C = { x: 1024, y: 520, r: 138 };
const SIRCLE = { x: 700, y: 780 };
const LANDMARKS = [ // [key, x(foot), y(foot), keepout radius]
  ['wheel_ruin', 1024, 548, 70], ['arch', 1024, 398, 40],
  ['pillar0', 925, 470, 14], ['pillar0', 1123, 470, 14], ['pillar1', 895, 565, 14], ['pillar2', 1153, 568, 14], ['pillar1', 962, 640, 14], ['pillar2', 1088, 642, 14], ['pillar2', 940, 420, 14],
  ['ruinwall', 878, 482, 24], ['ruinwall', 1172, 486, 24], ['ruinwall', 950, 668, 24], ['ruinwall', 1104, 672, 24],
  ['obelisk', 1092, 706, 18], ['blockmon', 958, 712, 22],
  ['signpost', 1066, 806, 10], ['signpost', 1010, 480, 10], ['signpost', 1560, 1030, 10],
  ['cheese_wheel', 400, 1235, 80], ['cheese_l0', 300, 1095, 34], ['cheese_l1', 540, 1290, 32], ['cheese_l0', 230, 1285, 34], ['cheese_l1', 585, 1060, 30],
  ['haystack', 1275, 1010, 18], ['haystack', 1655, 975, 18], ['haystack', 1655, 1040, 18], ['haystack', 1250, 1080, 18],
  ['scarecrow', 1550, 925, 10], ['scarecrow', 1370, 1095, 10],
  ['log0', 1560, 330, 20], ['log1', 1700, 470, 20], ['log0', 780, 270, 20], ['stump', 1480, 290, 8],
  ['oak0', 1210, 900, 14], ['oak4', 1180, 1030, 14], ['oak2', 880, 880, 14], ['oak3', 1280, 770, 14], ['oak1', 815, 690, 14],
];
for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; LANDMARKS.push([`menhir${i % 3}`, SIRCLE.x + Math.cos(a) * 40, SIRCLE.y + Math.sin(a) * 30 + 8, 8]); }

const FP = (k) => { if (/^oak/.test(k)) return 12; if (/^pine/.test(k)) return 8; if (/^dead/.test(k)) return 6; if (/^bush/.test(k)) return 9; if (/rock_l|cheese_l/.test(k)) return 24; if (/rock_m|cheese_m/.test(k)) return 12; if (/rock_s|cheese_s|wedge/.test(k)) return 6; if (/^log/.test(k)) return 20; if (/fence/.test(k)) return 3; if (/wheat|sunflower/.test(k)) return 5; return 7; };

export class World {
  constructor() {
    const t0 = performance.now();
    this.mat = new Uint8Array(CW * CH); this.tone = new Uint8Array(CW * CH); this.bio = new Uint8Array(CW * CH); this.edge = new Uint8Array(CW * CH);
    this.cache = new Map(); this.painted = new Set(); this.queue = null;
    this.build();
    this.placeProps();
    this.buildHash();
    this.buildMs = Math.round(performance.now() - t0);
  }

  // ------------------------------------------------------------ material map
  build() {
    const { mat, tone, bio } = this;
    const dist2 = (x, y, a, b) => Math.hypot(x - a, y - b);
    for (let cy = 0; cy < CH; cy++) for (let cx = 0; cx < CW; cx++) {
      const x = cx * CELL, y = cy * CELL, i = cy * CW + cx;
      // warped coordinates so the biome borders are organic
      const wx = x + (fbm(x * 0.006, y * 0.006, 2) - 0.5) * 160, wy = y + (fbm(x * 0.006 + 40, y * 0.006 + 40, 2) - 0.5) * 160;
      let best = 1e9, bb = 0;
      for (const [b, ax, ay, r] of centres) { const d = dist2(wx, wy, ax, ay) / r; if (d < best) { best = d; bb = b; } }
      const edgeD = Math.min(x, y, WW - x, WH - y) + (fbm(x * 0.02, y * 0.02, 2) - 0.5) * 50;
      if (edgeD < 72) bb = B.RIM;
      bio[i] = bb;
      const n1 = fbm(x * 0.012, y * 0.012, 3), n2 = fbm(x * 0.05 + 7, y * 0.05 + 3, 2), n3 = fbm(x * 0.021 + 91, y * 0.021 - 31, 2);
      let m = M.GRASS;
      if (bb === B.MEADOW) m = n3 > 0.66 ? M.FLOWERS : n1 > 0.64 ? M.DRY : M.GRASS;
      else if (bb === B.FOREST || bb === B.RIM) m = n3 > 0.55 ? M.LEAF : M.FOREST;
      else if (bb === B.CHEESE) m = n1 > 0.66 ? M.DIRT : n3 > 0.62 ? M.DRY : M.CHEESE;
      else if (bb === B.FARM) m = n3 > 0.62 ? M.DRY : M.GRASS;
      else if (bb === B.POND) m = n3 > 0.6 ? M.FLOWERS : M.GRASS;
      else if (bb === B.RUINS) m = n1 > 0.55 ? M.DRY : M.GRASS;
      mat[i] = m;
      tone[i] = Math.max(0, Math.min(255, (0.18 + 0.52 * n1 + 0.3 * n2) * 255 + (hash2(cx, cy) & 15) - 8));
    }
    // ponds: deep core, shallow ring, mud rim (union of warped ellipses)
    for (let cy = 0; cy < CH; cy++) for (let cx = 0; cx < CW; cx++) {
      const x = cx * CELL, y = cy * CELL; let w = 9;
      for (const p of ponds) { const dx = (x - p.x) / p.rx, dy = (y - p.y) / p.ry; const d = Math.hypot(dx, dy) + (fbm(x * 0.035, y * 0.035, 3) - 0.5) * 0.34; w = Math.min(w, d); }
      if (w < 1.18) { const i = cy * CW + cx; this.bio[i] = this.bio[i] === B.RIM ? B.RIM : B.POND; mat[i] = w < 0.62 ? M.DEEP : w < 0.95 ? M.SHALLOW : M.MUD; }
    }
    // seed farm plots, lanes
    for (const p of plots) for (let y = p.y - 6; y < p.y + p.h + 6; y += CELL) for (let x = p.x - 6; x < p.x + p.w + 6; x += CELL) {
      const i = (y >> 1) * CW + (x >> 1), inside = x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h;
      mat[i] = inside ? (p.kind === 'sprout' ? M.SPROUT : M.SOIL) : M.DIRT; this.bio[i] = B.FARM;
    }
    // stone circle floor
    for (let y = SIRCLE.y - 34; y < SIRCLE.y + 36; y += CELL) for (let x = SIRCLE.x - 56; x < SIRCLE.x + 56; x += CELL) { const d = Math.hypot((x - SIRCLE.x) / 56, (y - SIRCLE.y) / 34) + (fbm(x * 0.06, y * 0.06, 2) - 0.5) * 0.25; if (d < 0.78) mat[(y >> 1) * CW + (x >> 1)] = M.COBBLE; else if (d < 1) mat[(y >> 1) * CW + (x >> 1)] = M.DIRT; }
    // ruins plaza
    for (let y = RUIN_C.y - 190; y < RUIN_C.y + 190; y += CELL) for (let x = RUIN_C.x - 190; x < RUIN_C.x + 190; x += CELL) {
      const d = Math.hypot(x - RUIN_C.x, (y - RUIN_C.y) * 1.15) + (fbm(x * 0.04, y * 0.04, 3) - 0.5) * 60;
      const i = (y >> 1) * CW + (x >> 1); if (mat[i] === M.DEEP || mat[i] === M.SHALLOW) continue;
      if (d < RUIN_C.r) mat[i] = M.COBBLE; else if (d < RUIN_C.r + 22) mat[i] = (hash2(x >> 2, y >> 2) & 3) ? M.DIRT : M.COBBLE;
    }
    // paths
    this.pathPts = []; this.paths = [];
    for (const sp of SPLINES) {
      const arr = []; this.paths.push(arr);
      const pts = [sp[0], ...sp, sp[sp.length - 1]];
      for (let s = 1; s < pts.length - 2; s++) for (let t = 0; t < 1; t += 0.01) {
        const [p0, p1, p2, p3] = [pts[s - 1], pts[s], pts[s + 1], pts[s + 2]], t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        const x = f(p0[0], p1[0], p2[0], p3[0]), y = f(p0[1], p1[1], p2[1], p3[1]);
        this.pathPts.push([x, y]); arr.push([x, y]);
        const w = 6.5 + fbm(x * 0.05, y * 0.05, 2) * 4;
        for (let dy = -w; dy <= w; dy += CELL) for (let dx = -w; dx <= w; dx += CELL) {
          if (dx * dx + dy * dy > w * w) continue; const cx = (x + dx) >> 1, cy = (y + dy) >> 1; if (cx < 0 || cy < 0 || cx >= CW || cy >= CH) continue;
          const i = cy * CW + cx, m = mat[i]; if (m === M.DEEP || m === M.SHALLOW || m === M.COBBLE || m === M.SOIL || m === M.SPROUT) continue;
          mat[i] = M.DIRT;
        }
      }
    }
    // edge flags (hard borders between "families")
    const fam = (m) => (m === M.DIRT ? 1 : m === M.COBBLE ? 2 : m === M.SHALLOW ? 3 : m === M.DEEP ? 4 : m === M.SOIL || m === M.SPROUT ? 5 : 0);
    for (let cy = 1; cy < CH - 1; cy++) for (let cx = 1; cx < CW - 1; cx++) {
      const i = cy * CW + cx, f = fam(mat[i]); if (!f) continue;
      if (fam(mat[i - 1]) !== f || fam(mat[i + 1]) !== f || fam(mat[i - CW]) !== f || fam(mat[i + CW]) !== f) this.edge[i] = 1;
    }
  }
  matAt(x, y) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= WW || y >= WH) return M.FOREST; return this.mat[(y >> 1) * CW + (x >> 1)]; }
  deep(x, y) { return this.matAt(x, y) === M.DEEP; }
  isWalkMat(m) { return m !== M.DEEP; }

  // ------------------------------------------------------------ props
  placeProps() {
    const props = this.props = []; const r = rng(777);
    const fp = new Map(); const kfp = (x, y) => ((x >> 5) | ((y >> 5) << 7));
    const free = (x, y, rad) => { const cx = x >> 5, cy = y >> 5; for (let j = cy - 1; j <= cy + 1; j++) for (let i = cx - 1; i <= cx + 1; i++) { const l = fp.get(i | (j << 7)); if (l) for (const q of l) if (Math.hypot(q[0] - x, q[1] - y) < (q[2] + rad) * 0.85) return false; } return true; };
    const add = (k, x, y, extra = {}) => { const o = { k, x, y, ...extra }; props.push(o); const rad = FP(k); const key = kfp(x | 0, y | 0); (fp.get(key) || fp.set(key, []).get(key)).push([x, y, rad]); return o; };
    // landmarks first
    for (const [k, x, y] of LANDMARKS) add(k, x, y);
    // fences around the plots (gaps toward the lanes)
    for (const p of plots) {
      const gapX = p.x + p.w / 2, laneBottom = p.y < 1000;
      for (let x = p.x - 4; x < p.x + p.w + 10; x += 28) { if (Math.abs(x + 14 - gapX) < 20 && true) continue; add('fence_h', x + 14, p.y - 6, { noFp: 1 }); add('fence_h', x + 14, p.y + p.h + 8, { noFp: 1 }); }
      for (let y = p.y + 8; y < p.y + p.h + 4; y += 20) { add('fence_v', p.x - 8, y + 10); add('fence_v', p.x + p.w + 8, y + 10); }
    }
    // crops inside the plots
    for (const p of plots) {
      if (p.kind === 'sprout') continue;
      for (let y = p.y + 10; y < p.y + p.h - 4; y += 15) for (let x = p.x + 8; x < p.x + p.w - 6; x += 13) {
        const q = r(); const jx = x + (r() - 0.5) * 4, jy = y + (r() - 0.5) * 3;
        if (p.kind === 'sun') add(r() < 0.5 ? 'sunflower0' : 'sunflower1', jx, jy + 8, { sway: 1 });
        else if (q < 0.95) add(r() < 0.5 ? 'wheat0' : 'wheat1', jx, jy + 12, { sway: 1 });
      }
    }
    const step = 18;
    for (let gy = 10; gy < WH - 10; gy += step) for (let gx = 10; gx < WW - 10; gx += step) {
      const x = Math.round(gx + (r() - 0.5) * 16), y = Math.round(gy + (r() - 0.5) * 16);
      if (x < 8 || y < 8 || x > WW - 8 || y > WH - 8) continue;
      const i = (y >> 1) * CW + (x >> 1), b = this.bio[i], m = this.mat[i];
      if (m === M.DEEP || m === M.COBBLE) { continue; }
      if (m === M.DIRT || m === M.SOIL || m === M.SPROUT) { if (b === B.CHEESE && m === M.DIRT && r() < 0.03 && !this.nearPath(x, y, 14)) add('rock_s' + ((r() * 3) | 0), x, y); continue; }
      if (this.nearPath(x, y, 15)) continue;
      if (Math.hypot(x - START.x, y - START.y) < 46) continue;
      const c = fbm(x * 0.012 + 3, y * 0.012 + 7, 2), cl = 0.35 + c * 1.3, q = r();
      let key = null;
      if (m === M.SHALLOW) { if (q < 0.045) { const p = add('lily' + ((r() * 2) | 0), x, y, { z: 1.5 }); } continue; }
      if (m === M.MUD) { if (q < 0.4) key = 'reed' + ((r() * 2) | 0); else if (q < 0.45) key = 'rock_s' + ((r() * 3) | 0); }
      else if (b === B.RIM) { if (q < 0.55) key = r() < 0.55 ? 'pine' + ((r() * 3) | 0) : 'oak' + ((r() * 4) | 0); else if (q < 0.62) key = 'rock_m' + ((r() * 3) | 0); else if (q < 0.7) key = 'bush' + ((r() * 5) | 0); }
      else if (b === B.FOREST) {
        if (q < 0.2 * cl) key = r() < 0.65 ? 'pine' + ((r() * 3) | 0) : 'oak' + (r() < 0.6 ? 4 + ((r() * 3) | 0) : (r() * 4) | 0);
        else if (q < 0.2 * cl + 0.015) key = 'dead' + ((r() * 2) | 0); else if (q < 0.2 * cl + 0.07) key = 'bush' + ((r() * 5) | 0);
        else if (q < 0.2 * cl + 0.1) key = 'mush' + ((r() * 3) | 0); else if (q < 0.2 * cl + 0.108) key = 'log' + ((r() * 2) | 0); else if (q < 0.2 * cl + 0.116) key = 'stump'; else if (q < 0.2 * cl + 0.13) key = 'rock_s' + ((r() * 3) | 0);
      } else if (b === B.CHEESE) {
        if (q < 0.035 * cl) key = 'cheese_s' + (r() < 0.5 ? 0 : 1); else if (q < 0.035 * cl + 0.026) key = 'cheese_m' + (r() < 0.5 ? 0 : 1); else if (q < 0.035 * cl + 0.032) key = 'cheese_l' + (r() < 0.5 ? 0 : 1);
        else if (q < 0.035 * cl + 0.05) key = 'wedge' + (r() < 0.5 ? 0 : 1); else if (q < 0.035 * cl + 0.056) key = 'rock_m' + ((r() * 3) | 0); else if (q < 0.035 * cl + 0.066) key = 'dead' + ((r() * 2) | 0);
      } else if (b === B.FARM) { if (q < 0.012) key = 'bush' + ((r() * 5) | 0); else if (q < 0.02) key = 'rock_s' + ((r() * 3) | 0); else if (q < 0.04 && m !== M.DRY) key = 'sunflower' + ((r() * 2) | 0); }
      else if (b === B.POND) { if (q < 0.03 * cl) key = 'oak' + ((r() * 4) | 0); else if (q < 0.03 * cl + 0.05) key = 'bush' + ((r() * 5) | 0); else if (q < 0.03 * cl + 0.075) key = 'rock_s' + ((r() * 3) | 0); }
      else if (b === B.RUINS) { if (q < 0.02) key = 'rock_m' + ((r() * 3) | 0); else if (q < 0.045) key = 'bush' + ((r() * 5) | 0); else if (q < 0.06) key = 'rock_s' + ((r() * 3) | 0); }
      else { // meadow
        if (q < 0.026 * cl) key = 'oak' + ((r() * 4) | 0); else if (q < 0.026 * cl + 0.035) key = 'bush' + ((r() * 5) | 0); else if (q < 0.026 * cl + 0.055) key = 'rock_s' + ((r() * 3) | 0);
        else if (q < 0.026 * cl + 0.062) key = 'rock_m' + ((r() * 3) | 0); else if (q < 0.026 * cl + 0.07) key = 'mush' + ((r() * 3) | 0);
        else if (q < 0.026 * cl + 0.073 && c > 0.55) key = 'rock_l' + ((r() * 2) | 0);
      }
      if (!key || !PROPS[key]) continue;
      if (!free(x, y, FP(key))) continue;
      const pr = PROPS[key];
      // keep props off the pond waters
      if (!pr.ground && key.startsWith('reed') === false && (this.matAt(x - 6, y) === M.DEEP || this.matAt(x + 6, y) === M.DEEP || this.matAt(x, y - 6) === M.DEEP || this.matAt(x, y + 6) === M.SHALLOW)) continue;
      add(key, x, y, { sway: pr.sway });
    }
    // per-prop random flavour
    for (const p of props) { p.flip = r() < 0.5 && !/pillar|arch|ruin|obelisk|monument|blockmon|signpost|wheel|fence|cheese_wheel|scarecrow|haystack/.test(p.k); p.tint = PROPS[p.k]?.canopy ? [0xffffff, 0xf4ffee, 0xeef6e6, 0xfff8ec][(r() * 4) | 0] : 0xffffff; }
    this.props = props.filter((p) => PROPS[p.k]);
    // sparkle spots on the water
    this.sparks = []; for (let i = 0; i < 90; i++) { const x = ponds[i % ponds.length].x + (r() - 0.5) * 300, y = ponds[i % ponds.length].y + (r() - 0.5) * 200; if (this.matAt(x, y) === M.DEEP || this.matAt(x, y) === M.SHALLOW) this.sparks.push([x, y]); }
  }
  nearPath(x, y, rad) { for (let dy = -rad; dy <= rad; dy += 5) for (let dx = -rad; dx <= rad; dx += 5) { const m = this.matAt(x + dx, y + dy); if (m === M.DIRT || m === M.COBBLE) return true; } return false; }

  // ------------------------------------------------------------ collision
  buildHash() {
    this.GS = 48; this.GW = Math.ceil(WW / 48) + 1; this.GH = Math.ceil(WH / 48) + 1;
    this.hash = Array.from({ length: this.GW * this.GH }, () => null);
    this.tree = Array.from({ length: this.GW * this.GH }, () => null);
    this.props.forEach((p, idx) => {
      p.idx = idx; const pr = PROPS[p.k];
      for (const [dx, dy, rr] of pr.col) { const cx = Math.floor((p.x + dx) / 48), cy = Math.floor((p.y + dy) / 48); const k = cy * this.GW + cx; (this.hash[k] || (this.hash[k] = [])).push(p.x + dx, p.y + dy, rr); }
      if (pr.canopy) { const k = Math.floor(p.y / 48) * this.GW + Math.floor(p.x / 48); (this.tree[k] || (this.tree[k] = [])).push(p); }
    });
  }
  /** push a circle (x,y,r) out of solid props; returns [x,y,hit] (the shared result array is reused) */
  resolve(x, y, r) {
    const o = this._o || (this._o = [0, 0, 0]); let hit = 0;
    for (let it = 0; it < 2; it++) {
      const cx = Math.floor(x / 48), cy = Math.floor(y / 48);
      for (let j = cy - 1; j <= cy + 1; j++) for (let i = cx - 1; i <= cx + 1; i++) {
        if (i < 0 || j < 0 || i >= this.GW || j >= this.GH) continue;
        const l = this.hash[j * this.GW + i]; if (!l) continue;
        for (let q = 0; q < l.length; q += 3) {
          const dx = x - l[q], dy = y - l[q + 1], rr = l[q + 2] + r, d2 = dx * dx + dy * dy;
          if (d2 < rr * rr) { const d = Math.sqrt(d2) || 0.01; x += dx / d * (rr - d); y += dy / d * (rr - d); hit = 1; }
        }
      }
    }
    o[0] = x; o[1] = y; o[2] = hit; return o;
  }
  /** is a point blocked by a collider (used for spawn picking) */
  blocked(x, y, r) { const o = this.resolve(x, y, r); return o[2] === 1 || this.deep(x, y); }

  // ------------------------------------------------------------ ground chunks
  chunkKey(cx, cy) { return cy * 16 + cx; }
  chunkCanvas(cx, cy) {
    const k = this.chunkKey(cx, cy); let c = this.cache.get(k); if (c) return c;
    c = document.createElement('canvas'); c.width = c.height = CHT;
    const ctx = c.getContext('2d'), img = ctx.createImageData(CHT, CHT), buf = new Uint32Array(img.data.buffer);
    this.paintChunk(buf, cx, cy);
    ctx.putImageData(img, 0, 0); this.cache.set(k, c); return c;
  }
  paintChunk(buf, cx0, cy0) {
    const { mat, tone, edge } = this; const gx0 = cx0 * CHT, gy0 = cy0 * CHT;
    for (let ty = 0; ty < CHT; ty++) {
      const gy = gy0 + ty;
      for (let tx = 0; tx < CHT; tx++) {
        const gx = gx0 + tx, h = hash2(gx >> 1, gy >> 1), jx = (h & 3) - 1, jy = ((h >> 2) & 3) - 1;
        let cx = (gx + jx) >> 2, cy = (gy + jy) >> 2; if (cx < 0) cx = 0; else if (cx >= CW) cx = CW - 1; if (cy < 0) cy = 0; else if (cy >= CH) cy = CH - 1;
        const ci = cy * CW + cx, m = mat[ci]; let t = tone[ci] / 255; const e = edge[ci];
        const bay = BAY[((gy & 3) << 2) | (gx & 3)] / 16 - 0.5, sp = (h >> 6) & 31;
        let col;
        if (m === M.COBBLE) {
          const row = Math.floor(gy / 9), off = (row & 1) * 7, sxp = gx + off, col0 = Math.floor(sxp / 14), lx = sxp - col0 * 14, ly = gy - row * 9;
          const sh = hash2(col0, row), mortar = lx === 0 || ly === 0 || (lx === 1 && ly === 1) || (e && (lx === 13));
          if (mortar) col = MORTAR;
          else {
            let v = (sh & 255) / 255 * 0.55 + t * 0.3 + (lx < 3 && ly < 3 ? 0.18 : 0) - (ly > 6 ? 0.14 : 0) + bay * 0.25; let ix = Math.max(0, Math.min(4, Math.round(v * 4 + 0.4)));
            col = COB[ix]; if (((sh >> 8) & 7) === 0 && fbm(gx * 0.03, gy * 0.03, 1) > 0.5) col = MOSSU[(lx + ly) & 1];
          }
          if (e && !mortar && (lx < 1)) col = MORTAR;
        } else {
          const P = PALU[m]; const n = P.length;
          if (m === M.SOIL || m === M.SPROUT) { t = 0.35 + t * 0.35 + (((gy >> 2) & 1) ? 0.22 : -0.1); }
          else if (m === M.DEEP) { t = 0.25 + t * 0.5 + ((hash2(gx >> 3, gy >> 1) & 15) === 0 ? 0.35 : 0); }
          else if (m === M.SHALLOW) { t = 0.35 + t * 0.4 + ((hash2(gx >> 3, gy >> 1) & 15) === 0 ? 0.3 : 0) + (e ? 0.3 : 0); }
          else if (m === M.DIRT) { t = 0.25 + t * 0.55 - (e ? 0.45 : 0); }
          else if (m === M.CHEESE) { // holes
            const hx = Math.floor(gx / 26), hy = Math.floor(gy / 26), hh = hash2(hx, hy), ox = hx * 26 + 5 + (hh & 15), oy = hy * 26 + 5 + ((hh >> 4) & 15), rad = 2 + ((hh >> 8) & 3), d2 = (gx - ox) ** 2 + (gy - oy) ** 2;
            if ((hh >> 12) & 1 && d2 < rad * rad) t = (gx - ox + gy - oy < 0) ? 0.02 : 0.1; else if ((hh >> 12) & 1 && d2 < (rad + 1.4) * (rad + 1.4)) t = 0.95;
          }
          let v = t * (n - 1) + bay * 0.9 + (sp === 0 ? 1 : sp === 1 ? -1 : 0);
          let ix = Math.round(v); ix = ix < 0 ? 0 : ix >= n ? n - 1 : ix; col = P[ix];
          if (m === M.SPROUT) { const sx = gx % 11, sy = gy % 8; if (((gy >> 3) & 0) === 0 && sx >= 4 && sx <= 5 && sy >= 2 && sy <= 4) col = sy === 2 ? toU32('#9be05a') : toU32('#4fa244'); if (sx === 3 && sy === 3 || sx === 6 && sy === 3) col = toU32('#6ec24f'); }
          if (m === M.GRASS && (e === 0)) { /* plain */ }
        }
        buf[ty * CHT + tx] = col;
      }
    }
    this.decals(buf, cx0, cy0);
  }
  decals(buf, cx0, cy0) {
    const r = rng(cx0 * 9973 + cy0 * 131 + 5), gx0 = cx0 * CHT, gy0 = cy0 * CHT;
    const px = (x, y, c) => { if (x >= 0 && y >= 0 && x < CHT && y < CHT) buf[y * CHT + x] = c; };
    const C = (h) => toU32(h);
    const flowerCols = ['#ff6b8a', '#ffd23f', '#ffffff', '#b58cff', '#ff9a3c', '#6ec6ff'].map(C);
    for (let n = 0; n < 150; n++) {
      const tx = (r() * (CHT - 6) + 3) | 0, ty = (r() * (CHT - 8) + 5) | 0, wx = (gx0 + tx) / 2, wy = (gy0 + ty) / 2, m = this.matAt(wx, wy), q = r();
      if (m === M.GRASS || m === M.FLOWERS || m === M.FOREST || m === M.DRY) {
        const dark = m === M.FOREST ? ['#1e4528', '#3f8a4c'] : m === M.DRY ? ['#6b7430', '#c4c070'] : ['#2f6a30', '#6cbc5a'];
        if (m === M.FLOWERS ? q < 0.4 : q < (m === M.GRASS ? 0.08 : 0.02)) { const fc = flowerCols[(r() * 6) | 0]; px(tx, ty, C('#ffe58a')); px(tx - 1, ty, fc); px(tx + 1, ty, fc); px(tx, ty - 1, fc); px(tx, ty + 1, fc); px(tx, ty + 2, C('#3a8a3a')); px(tx, ty + 3, C('#2f6a30')); }
        else if (q < 0.7) { px(tx, ty, C(dark[0])); px(tx, ty - 1, C(dark[1])); px(tx - 1, ty - 1, C(dark[1])); px(tx + 1, ty - 2, C(dark[1])); px(tx - 1, ty - 2, C(dark[1])); px(tx, ty - 2, C(dark[1])); px(tx + 1, ty - 1, C(dark[0])); }
        else if (q < 0.76) { px(tx, ty, C('#9a9aa2')); px(tx + 1, ty, C('#7a7a84')); px(tx, ty + 1, C('#6a6a74')); px(tx + 1, ty + 1, C('#55555f')); px(tx, ty - 1, C('#c8c8d0')); }
      } else if (m === M.LEAF) { if (q < 0.55) { const lc = ['#d9822b', '#c4452f', '#e0a62e', '#a65a2a'].map(C)[(r() * 4) | 0]; px(tx, ty, lc); px(tx + 1, ty, lc); px(tx + (r() < 0.5 ? 0 : 1), ty - 1, lc); } }
      else if (m === M.CHEESE) { if (q < 0.5) { px(tx, ty, C('#fff0a0')); px(tx + 1, ty, C('#f7d35a')); px(tx, ty + 1, C('#b88a22')); } }
      else if (m === M.DIRT || m === M.MUD) { if (q < 0.35) { px(tx, ty, C('#b9a98c')); px(tx + 1, ty, C('#8a7a62')); px(tx, ty + 1, C('#55452e')); } else if (q < 0.5) { px(tx, ty, C('#e6c04a')); px(tx + 1, ty, C('#a47a1e')); } }
    }
  }

  // ------------------------------------------------------------ scene integration
  attach(scene) {
    this.scene = scene; this.imgs = new Map(); this.sceneKey = 'wc';
    const all = []; for (let cy = 0; cy < WH / CHUNK; cy++) for (let cx = 0; cx < WW / CHUNK; cx++) all.push([cx, cy]);
    this.all = all; this.pending = new Set(all.map(([x, y]) => this.chunkKey(x, y)));
  }
  ensureChunk(cx, cy) {
    const k = this.chunkKey(cx, cy); if (this.imgs.has(k)) return;
    const c = this.chunkCanvas(cx, cy), tk = `${this.sceneKey}_${k}`;
    if (!this.scene.textures.exists(tk)) this.scene.textures.addCanvas(tk, c);
    this.imgs.set(k, this.scene.add.image(cx * CHUNK, cy * CHUNK, tk).setOrigin(0).setScale(0.5).setDepth(0));
    this.pending.delete(k);
  }
  /** make sure every chunk touching the rectangle is painted */
  ensureRect(x0, y0, x1, y1) {
    for (let cy = Math.max(0, Math.floor(y0 / CHUNK)); cy <= Math.min(WH / CHUNK - 1, Math.floor(y1 / CHUNK)); cy++)
      for (let cx = Math.max(0, Math.floor(x0 / CHUNK)); cx <= Math.min(WW / CHUNK - 1, Math.floor(x1 / CHUNK)); cx++) this.ensureChunk(cx, cy);
  }
  ensureAll() { this.all.forEach(([x, y]) => this.ensureChunk(x, y)); }
  /** per-frame: guarantee the view is painted, then paint one more chunk (nearest first) when idle */
  stream(cam, px, py) {
    const v = cam.worldView, ax = v.width ? v.x : px - 240, ay = v.width ? v.y : py - 135, aw = v.width || 480, ah = v.height || 270;
    this.ensureRect(ax - 24, ay - 24, ax + aw + 24, ay + ah + 24);
    if (this.pending.size) {
      let best = null, bd = 1e12;
      for (const k of this.pending) { const cx = k % 16, cy = (k / 16) | 0, d = (cx * CHUNK + 64 - px) ** 2 + (cy * CHUNK + 64 - py) ** 2; if (d < bd) { bd = d; best = [cx, cy]; } }
      if (best) this.ensureChunk(best[0], best[1]);
    }
  }
  /** create the prop sprites (y-sorted by the depth value) */
  populate(scene, SC) {
    this.objs = [];
    for (const p of this.props) {
      const pr = PROPS[p.k];
      const im = scene.add.image(p.x, p.y, p.k).setOrigin(pr.fx / pr.w, pr.fy / pr.h).setScale(SC).setDepth(p.z ? p.z : 100 + p.y * 0.05);
      if (p.flip) im.setFlipX(true); if (p.tint !== 0xffffff) im.setTint(p.tint);
      p.o = im; p.base = im.y; p.a = 1; this.objs.push(im);
    }
    // water sparkles
    this.sparkObjs = this.sparks.map(([x, y], i) => { const s = scene.add.image(x, y, 'sparkle').setScale(0.5).setDepth(1.2).setAlpha(0); scene.tweens.add({ targets: s, alpha: { from: 0, to: 0.9 }, scale: { from: 0.25, to: 0.55 }, duration: 600 + (i % 7) * 120, yoyo: true, repeat: -1, delay: (i * 137) % 2400, repeatDelay: 600 + (i * 53) % 2500, ease: 'Sine.easeInOut' }); return s; });
    // swaying plants: handled in update for visible ones only
    this.swayList = this.props.filter((p) => p.sway);
    this.fade = new Set();
  }
  /** per-frame world upkeep: canopy fade near the player + plant sway */
  update(dt, t, px, py, cam) {
    // canopy fade
    const cx = Math.floor(px / 48), cy = Math.floor(py / 48), want = new Set();
    for (let j = cy; j <= cy + 3; j++) for (let i = cx - 2; i <= cx + 2; i++) {
      if (i < 0 || j < 0 || i >= this.GW || j >= this.GH) continue; const l = this.tree[j * this.GW + i]; if (!l) continue;
      for (const p of l) { const pr = PROPS[p.k]; const dx = Math.abs(px - p.x), dy = p.y - py; if (dx < pr.w * 0.38 && dy > 2 && dy < pr.fy * 0.9) want.add(p); }
    }
    want.forEach((p) => this.fade.add(p));
    const k = 1 - Math.exp(-dt * 9);
    for (const p of this.fade) {
      const target = want.has(p) ? 0.42 : 1; p.a += (target - p.a) * k; p.o.setAlpha(p.a);
      if (!want.has(p) && p.a > 0.995) { p.o.setAlpha(1); p.a = 1; this.fade.delete(p); }
    }
    // sway (crops/reeds): only those on screen, a cheap shear via rotation
    const v = cam.worldView, x0 = v.x - 20, y0 = v.y - 20, x1 = v.x + v.width + 20, y1 = v.y + v.height + 60;
    for (const p of this.swayList) { if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue; p.o.setRotation(Math.sin(t * 1.7 + p.x * 0.05 + p.y * 0.03) * 0.045); }
  }
}

let _world = null;
export function getWorld() { return _world || (_world = new World()); }

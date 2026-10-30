// 8-directional hamster hero. One parametric renderer draws the character at any head/body yaw:
// 5 unique views (front, front-3/4, side, back-3/4, back) – the 3 west-side directions are mirrored at runtime.
import { Pix, ramp } from './pix.js';
const EYE = ramp('#2a1a38'), MOUTH = ramp('#6a1428'), PINK = ramp('#f27b92'), TEETH = ramp('#fff4e0'), LINE = ramp('#2a1a38');
const FUR = ramp('#e9a24e'), FUR_D = ramp('#b9682a'), FUR_B = ramp('#cf8a3c'), CREAM = ramp('#fbe6bf'), CHEEK = ramp('#f3c98a'), SCARF = ramp('#d9304a'), SCARF_L = ramp('#ff6b7e');
const WHITE = [255, 255, 255];
const D = Math.PI / 180, S = Math.sin, C = Math.cos;
export const HERO_SIZE = 56;
export const HERO_VIEWS = [{ id: 'f', theta: 0 }, { id: 'q', theta: 45 }, { id: 's', theta: 90 }, { id: 'bq', theta: 135 }, { id: 'b', theta: 180 }];
/** screen-angle octants (0 = east, clockwise, y down) → [view id, mirror] */
export const DIR8 = [['s', 0], ['q', 0], ['f', 0], ['q', 1], ['s', 1], ['bq', 1], ['b', 0], ['bq', 0]];

function hero(theta, kind, f) {
  const p = new Pix(HERO_SIZE, HERO_SIZE, HERO_SIZE / 48), T = theta * D, sT = S(T), cT = C(T), back = cT < -0.05;
  const WF = 8; let bob = 0, sw = 0, arm = 0, flap = 1, blink = false;
  if (kind === 'w') { const a = (f / WF) * Math.PI * 2; sw = C(a); bob = -(1 - C(a * 2)) / 2 * 1.2; arm = -1.5 * sw; flap = 1.5 - 1.5 * sw; }
  if (kind === 'i') { bob = [0, -1, 0][f]; blink = f === 2; flap = [1, 2, 1][f]; }
  const az = (a, R, c) => c + R * S(a * D + T), dp = (a) => C(a * D + T);
  const bx = 24 - 1.2 * sT, by = 34 + bob, hx = 24 + 5.2 * sT, hy = 21 + bob;
  const hrx = 13.8 + 3.8 * Math.abs(cT), hry = 13.2;
  const bodyRx = 14.5 + 1.8 * Math.abs(sT);
  // ---- feet (pink pads) ----
  for (const sg of [-1, 1]) {
    const ph = sg * sw, fx = az(sg * 36, 11, bx) + ph * 3.6 * sT, fy = 43.5 + ph * 1.1 * cT - Math.max(0, -ph) * 1.4 * Math.abs(sT) + bob * 0.3;
    p.blob(fx, fy, 5.2 + 0.8 * Math.abs(sT), 3.4, back ? FUR_B : PINK);
    if (back) p.blob(fx, fy + 0.6, 3, 1.7, PINK, { dither: 0.2 });
  }
  // ---- tail nub + scarf tail (behind) ----
  const tailD = dp(180);
  if (tailD < 0.2) p.blob(az(180, 13, bx), 40 + bob, 3, 3, CREAM);
  const kx = az(140, 12.5, bx), kd = dp(140), dir = kx >= bx ? 1 : -1;
  if (kd < 0.1) p.poly([[kx, 33 + bob], [kx + dir * 7, 30.5 + bob - flap], [kx + dir * 12, 33.5 + bob - flap * 1.3], [kx + dir * 6, 37 + bob], [kx, 37 + bob]], SCARF);
  // far arm
  const arms = [[-78, arm], [78, -arm]];
  for (const [a, ao] of arms) if (dp(a) < 0.05) { p.blob(az(a, 13.5, bx), 36 + bob + ao, 3.4, 4.2, FUR_B); }
  // ---- torso ----
  p.blob(bx, by, bodyRx, 11, FUR);
  if (!back) p.blob(az(0, 6.5, bx), 37 + bob, 9 * Math.max(0.5, Math.abs(cT)) + 1.5, 6.6, CREAM);
  else { p.blob(bx, 33 + bob, 3, 8, FUR_D, { dither: 0.45, bias: -0.05 }); p.blob(az(180, 5, bx), 41 + bob, 3.2, 2.6, CREAM, { dither: 0.2 }); } // spine stripe + tail tuft
  // near arms / paws
  for (const [a, ao] of arms) if (dp(a) >= 0.05) { const ax = az(a, 13.2, bx); p.blob(ax, 36 + bob + ao, 3.6, 4.2, FUR); p.blob(ax, 39 + bob + ao, 2.8, 2.2, back ? FUR_B : CREAM, { dither: 0.2 }); }
  // scarf ring
  p.blob(bx, 34.5 + bob, 12.2 + 1.5 * Math.abs(sT), 3.2, SCARF, { dither: 0.3 });
  p.blob(bx - 3, 33.5 + bob, 6, 1.1, SCARF_L, { dither: 0.15, bias: 0.12 });
  if (kd >= 0.1) { p.blob(kx, 35 + bob, 3, 3, SCARF, { dither: 0.2 }); p.poly([[kx, 36 + bob], [kx + dir * 3, 40 + bob + flap * 0.4], [kx + dir * 1, 41 + bob + flap * 0.4]], SCARF); }
  // ---- ears ----
  for (const a of [-58, 58]) {
    const ex = az(a, 12.6, hx), ec = Math.max(0.55, Math.abs(dp(a) * 0.5 + 0.5)), ey = 9.5 + bob - 0.6 * (1 - Math.abs(C(a * D + T)));
    p.blob(ex, ey, 6.2 * ec, 6.6, FUR);
    if (dp(a) > 0.1) p.blob(ex + 0.4 * sT, ey + 1, 3.4 * ec, 4, PINK, { bias: 0.05, dither: 0.2 });
    else p.blob(ex, ey + 1.4, 3.2 * ec, 3.4, FUR_B, { dither: 0.5 });
  }
  // ---- muzzle poking out of the silhouette in 3/4-back views, then head ----
  const muzD = dp(0);
  if (muzD < 0.05 && Math.abs(sT) > 0.5) p.blob(az(0, 11, hx), 26.5 + bob, 5, 4.2, CREAM, { dither: 0.3 });
  p.blob(hx, hy, hrx, hry, FUR);
  if (back) { p.blob(hx, 14.5 + bob, 5, 2.6, FUR_B, { dither: 0.5, bias: -0.02 }); p.blob(hx, 19 + bob, 1.6, 5, FUR_D, { dither: 0.6, bias: 0.05 }); p.blob(hx - 2 * sT, 28 + bob, 7, 3, FUR_B, { dither: 0.5 }); }
  else p.blob(az(0, 4.5, hx), 12.6 + bob, 4.4 * Math.max(0.5, Math.abs(cT)), 2.6, ramp('#c97c34'), { dither: 0.2 });
  // cheeks (visible side puffs)
  for (const a of [-52, 52]) { const d = dp(a); if (d > -0.15) p.blob(az(a, 11.5, hx), 26 + bob, (6 - 1.2 * Math.abs(sT)) * Math.max(0.5, d + 0.2), 5, CHEEK, { dither: 0.3 }); }
  if (!back) {
    const md = Math.max(0.5, Math.abs(muzD) + 0.1);
    p.blob(az(0, 9.5, hx), 26.5 + bob, 7.4 * md + (Math.abs(sT) > 0.7 ? 1.3 : 0), 5.2, CREAM, { dither: 0.3 });
    // eyes
    for (const a of [-24, 24]) {
      const d = dp(a); if (d <= 0.08) continue; const ex = az(a, 10.4, hx), w = 3.2 * Math.max(0.62, d);
      if (blink) { p.line(ex - w, 21 + bob, ex + w, 21 + bob, 1.1, LINE); continue; }
      p.blob(ex, 21 + bob, w, 4, EYE, { dither: 0.15 });
      p.rect(ex - w * 0.45, 18.8 + bob, 1.8, 1.8, WHITE); p.rect(ex + w * 0.2, 22.8 + bob, 1, 1, [150, 190, 255]);
      p.line(ex - w - 0.8, 16.6 + bob, ex + w + 0.6, 15.8 + bob, 1.1, FUR_D);
    }
    // nose, mouth, teeth
    const nx = az(0, 11.4, hx);
    p.blob(nx, 24.6 + bob, 2.3 * Math.max(0.6, md), 1.6, PINK, { bias: 0.1, dither: 0.1 });
    if (md > 0.5 || Math.abs(sT) > 0.6) {
      const mx = az(0, 9.8, hx), ms = Math.max(0.45, md);
      p.line(mx - 2.4 * ms, 28.4 + bob, mx, 29.6 + bob, 0.9, MOUTH).line(mx, 29.6 + bob, mx + 2.4 * ms, 28.4 + bob, 0.9, MOUTH);
      p.blob(mx - 1.2 * ms, 30.6 + bob, 1.4 * ms, 1.8, TEETH, { dither: 0.1 }).blob(mx + 1.2 * ms, 30.6 + bob, 1.4 * ms, 1.8, TEETH, { dither: 0.1 });
    }
  }
  p.outline(1);
  return p.done();
}

export function buildHero(add, ANIMS) {
  for (const v of HERO_VIEWS) {
    for (let f = 0; f < 8; f++) add(`h${v.id}_w${f}`, hero(v.theta, 'w', f));
    for (let f = 0; f < 3; f++) add(`h${v.id}_i${f}`, hero(v.theta, 'i', f));
    ANIMS.push({ key: `h${v.id}_walk`, frames: Array.from({ length: 8 }, (_, f) => `h${v.id}_w${f}`), rate: 17 });
    ANIMS.push({ key: `h${v.id}_idle`, frames: [`h${v.id}_i0`, `h${v.id}_i1`, `h${v.id}_i0`, `h${v.id}_i1`, `h${v.id}_i0`, `h${v.id}_i2`, `h${v.id}_i1`], rate: 3.5 });
  }
}

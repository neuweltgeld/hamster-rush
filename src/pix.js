// Pixel-art toolkit: colour ramps + the Pix canvas painter (shared by sprites.js and worldart.js)
// ------------------------------------------------------------------ colour helpers
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const hex2rgb = (h) => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map((c) => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const rgb2hsl = ([r, g, b]) => {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60;
  }
  return [h, s, l];
};
export const hsl2rgb = ([h, s, l]) => {
  h = ((h % 360) + 360) % 360 / 360;
  const f = (p, q, t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  return [f(p, q, h + 1 / 3), f(p, q, h), f(p, q, h - 1 / 3)].map((v) => Math.round(v * 255));
};
export const hueToward = (h, target, amt) => { let d = ((target - h + 540) % 360) - 180; return h + d * amt; };
export const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
/** n-step ramp around a base colour: shadows drift cool/saturated, highlights drift warm/pale (mid index ≈ base). */
export function ramp(base, n = 5) {
  const [h, s, l] = rgb2hsl(hex2rgb(base)); const out = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), d = t - 0.5;
    const L = clamp(l + d * 0.52, 0.05, 0.93);
    const H = d < 0 ? hueToward(h, 255, -d * 0.16) : hueToward(h, 52, d * 0.2);
    const S = clamp(s * (d < 0 ? 1 + -d * 0.35 : 1 - d * 0.45));
    out.push(hsl2rgb([H, S, L]));
  }
  return out;
}
export const OUTC = (c) => { const [h, s, l] = rgb2hsl(c); return hsl2rgb([hueToward(h, 265, 0.18), clamp(s * 0.8 + 0.1), clamp(l * 0.3, 0.05, 0.2)]); };
export const WHITE = [255, 255, 255];
export const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16);
export const LIGHT = (() => { const l = [-0.5, -0.7, 0.55]; const m = Math.hypot(...l); return l.map((v) => v / m); })();

export class Pix {
  constructor(w, h = w, k = 1) {
    this.w = w; this.h = h; this.k = k;
    this.c = document.createElement('canvas'); this.c.width = w; this.c.height = h;
    this.ctx = this.c.getContext('2d');
    this.d = new Uint8ClampedArray(w * h * 4);
    this.ol = new Uint8Array(w * h); // outline mask (for hit-flash)
  }
  _set(x, y, c, a = 255) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; const i = (y * this.w + x) * 4; this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = a; }
  _a(x, y) { return (x < 0 || y < 0 || x >= this.w || y >= this.h) ? 0 : this.d[(y * this.w + x) * 4 + 3]; }
  _shadeIdx(r, v, x, y, dith) { const n = r.length; return clamp(Math.round(v * (n - 1) + (BAYER[(y & 3) * 4 + (x & 3)] - 0.5) * dith), 0, n - 1); }
  /** shaded ellipse ("sphere" lighting) */
  blob(cx, cy, rx, ry, r, o = {}) {
    const k = this.k; cx *= k; cy *= k; rx *= k; ry *= k;
    const dith = o.dither ?? 0.45, bias = o.bias ?? 0, L = o.light || LIGHT;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, d2 = dx * dx + dy * dy;
      if (d2 > 1) continue;
      const nz = Math.sqrt(1 - d2), lam = dx * L[0] + dy * L[1] + nz * L[2];
      let v = 0.1 + 0.74 * Math.max(0, lam) + bias;
      if (dx * 0.55 + dy * 0.8 > 0.66 && d2 > 0.55) v += 0.08; // bounce light on the lower rim
      this._set(x, y, r[this._shadeIdx(r, clamp(v), x, y, dith)]);
    }
    return this;
  }
  /** polygon with a diagonal light gradient */
  poly(pts, r, o = {}) {
    const k = this.k; pts = pts.map(([x, y]) => [x * k, y * k]);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const x0 = Math.floor(Math.min(...xs)), x1 = Math.ceil(Math.max(...xs)), y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
    const bw = Math.max(1, x1 - x0), bh = Math.max(1, y1 - y0), dith = o.dither ?? 0.4, bias = o.bias ?? 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5; let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
      }
      if (!inside) continue;
      const t = 1 - ((px - x0) / bw * 0.45 + (py - y0) / bh * 0.55);
      this._set(x, y, o.flat != null ? r[o.flat] : r[this._shadeIdx(r, clamp(0.1 + t * 0.7 + bias), x, y, dith)]);
    }
    return this;
  }
  /** round-capped thick line, lit from the top-left */
  line(x0, y0, x1, y1, w, r) {
    const k = this.k; x0 *= k; y0 *= k; x1 *= k; y1 *= k; w *= k;
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5)), m = r.length >> 1;
    const stamp = (cx, cy, rad, c) => { for (let y = Math.floor(cy - rad); y <= Math.ceil(cy + rad); y++) for (let x = Math.floor(cx - rad); x <= Math.ceil(cx + rad); x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= rad * rad) this._set(x, y, c); };
    for (let i = 0; i <= steps; i++) { const t = i / steps; stamp(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, w / 2, r[Math.max(0, m - 1)]); }
    if (w >= 2.5) for (let i = 0; i <= steps; i++) { const t = i / steps; stamp(x0 + (x1 - x0) * t - w * 0.12, y0 + (y1 - y0) * t - w * 0.14, w * 0.3, r[Math.min(r.length - 1, m + 1)]); }
    return this;
  }
  rect(x, y, w, h, c) { const k = this.k; for (let j = Math.floor(y * k); j < Math.floor((y + h) * k); j++) for (let i = Math.floor(x * k); i < Math.floor((x + w) * k); i++) this._set(i, j, c); return this; }
  /** banded vertical rect (planks, metal) with a lit left/top edge */
  slab(x, y, w, h, r) {
    const k = this.k, X = Math.floor(x * k), Y = Math.floor(y * k), W = Math.max(1, Math.floor(w * k)), H = Math.max(1, Math.floor(h * k));
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      let v = 0.78 - (j / H) * 0.5; if (i === 0 || j === 0) v += 0.2; if (i === W - 1 || j === H - 1) v -= 0.2;
      this._set(X + i, Y + j, r[this._shadeIdx(r, clamp(v), X + i, Y + j, 0.35)]);
    }
    return this;
  }
  dot(x, y, c, s = 1) { return this.rect(x, y, s, s, c); }
  /** dark selective outline: each border pixel takes a darkened copy of the neighbouring colour */
  outline(width = 1) {
    for (let pass = 0; pass < width; pass++) {
      const todo = [];
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        if (this._a(x, y) > 0) continue;
        let sr = 0, sg = 0, sb = 0, n = 0;
        for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { if (this._a(x + ax, y + ay) > 200) { const i = ((y + ay) * this.w + x + ax) * 4; sr += this.d[i]; sg += this.d[i + 1]; sb += this.d[i + 2]; n++; } }
        if (n) todo.push([x, y, OUTC([sr / n, sg / n, sb / n])]);
      }
      todo.forEach(([x, y, c]) => { this._set(x, y, c); this.ol[y * this.w + x] = 1; });
    }
    return this;
  }
  /** soft ground shadow (only on empty pixels, after outlining) */
  shadow(cx, cy, rx, ry, a = 90) {
    const k = this.k; cx *= k; cy *= k; rx *= k; ry *= k;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, d2 = dx * dx + dy * dy;
      if (d2 <= 1 && this._a(x, y) === 0) this._set(x, y, [8, 6, 20], d2 < 0.55 ? a : a * 0.55);
    }
    return this;
  }
  /** hit flash: blend the whole sprite toward white (outline only a little) */
  whiten(f = 0.6) {
    for (let i = 0; i < this.w * this.h; i++) {
      if (this.d[i * 4 + 3] < 255) continue; const t = this.ol[i] ? f * 0.35 : f;
      for (let c = 0; c < 3; c++) this.d[i * 4 + c] = Math.round(this.d[i * 4 + c] + (255 - this.d[i * 4 + c]) * t);
    }
    return this;
  }
  clear(x, y, w, h) { const k = this.k; for (let j = Math.floor(y * k); j < Math.ceil((y + h) * k); j++) for (let i = Math.floor(x * k); i < Math.ceil((x + w) * k); i++) if (i >= 0 && j >= 0 && i < this.w && j < this.h) this.d[(j * this.w + i) * 4 + 3] = 0; return this; }
  clearEllipse(cx, cy, rx, ry) { const k = this.k; cx *= k; cy *= k; rx *= k; ry *= k; for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) this.d[(y * this.w + x) * 4 + 3] = 0; return this; }
  done() { this.ctx.putImageData(new ImageData(this.d, this.w, this.h), 0, 0); this.finished = true; return this; }
  scaled(kk) {
    const n = new Pix(this.w * kk, this.h * kk);
    for (let y = 0; y < n.h; y++) for (let x = 0; x < n.w; x++) { const si = (Math.floor(y / kk) * this.w + Math.floor(x / kk)) * 4, di = (y * n.w + x) * 4; for (let c = 0; c < 4; c++) n.d[di + c] = this.d[si + c]; }
    return n.done();
  }
}

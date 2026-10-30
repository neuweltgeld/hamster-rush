// Juice layer: pooled particles, rings/glows, explosions, damage numbers, camera shake, bloom + vignette.
import Phaser from 'phaser';
import { ImgPool } from './pool.js';

const ADD = Phaser.BlendModes.ADD;
const TAU = Math.PI * 2;
const easeOut = (u) => 1 - (1 - u) * (1 - u);
const pop = (u) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); };

export class Vfx {
  constructor(scene, quality = 2) {
    this.s = scene; this.cam = scene.cameras.main; this.q = quality; this.qs = [0.4, 0.7, 1][quality] ?? 1;
    this.imgs = new ImgPool(scene); this.fx = []; this.nums = []; this.digitFree = [];
    this.bolts = []; this.trauma = 0; this.ox = 0; this.oy = 0; this._tint = 0xffffff; this.hitStop = 0;
    const tint = { onEmit: () => this._tint };
    const mk = (tex, cfg, depth = 195) => scene.add.particles(0, 0, tex, { emitting: false, maxAliveParticles: 260, tint, ...cfg }).setDepth(depth);
    this.spark = mk('fx_spark', { lifespan: { min: 160, max: 420 }, speed: { min: 50, max: 200 }, scale: { start: 0.75, end: 0 }, rotate: { min: 0, max: 180 }, blendMode: 'ADD', alpha: { start: 1, end: 0 } });
    this.glowp = mk('fx_glow_sm', { lifespan: { min: 260, max: 520 }, speed: { min: 10, max: 70 }, scale: { start: 0.55, end: 1.4 }, alpha: { start: 0.85, end: 0 }, blendMode: 'ADD' });
    this.smoke = mk('fx_smoke', { lifespan: { min: 500, max: 900 }, speed: { min: 8, max: 45 }, scale: { start: 0.3, end: 0.85 }, alpha: { start: 0.55, end: 0 }, gravityY: -14, rotate: { min: 0, max: 360 } }, 194);
    this.chunk = mk('fx_chunk', { lifespan: { min: 420, max: 800 }, speed: { min: 45, max: 150 }, scale: { start: 0.55, end: 0.25 }, gravityY: 190, rotate: { min: 0, max: 360 }, alpha: { start: 1, end: 0 } });
    this.ember = mk('fx_dot', { lifespan: { min: 380, max: 900 }, speed: { min: 8, max: 40 }, scale: { start: 0.9, end: 0 }, gravityY: -40, blendMode: 'ADD' });
    this.star = mk('fx_star', { lifespan: { min: 220, max: 420 }, speed: { min: 0, max: 40 }, scale: { start: 0.55, end: 0 }, rotate: { min: -90, max: 90 }, blendMode: 'ADD' });
    this.flame = mk('fx_flame', { lifespan: { min: 180, max: 380 }, speed: { min: 20, max: 60 }, scale: { start: 0.9, end: 0.2 }, alpha: { start: 0.9, end: 0 }, blendMode: 'ADD', gravityY: -50 });
    this.fxHud = scene.add.graphics().setDepth(196); this.g = this.fxHud.setBlendMode(ADD); this._gdirty = false;
    this.initPost();
  }
  initPost() {
    this.bloom = null; this.vig = null; this.post = false;
    try {
      const r = this.s.game.renderer;
      if (r.type !== Phaser.WEBGL || !this.cam.postFX) return;
      this.bloom = this.cam.postFX.addBloom(0xffffff, 1, 1, 0.9, 0.55, 4);
      this.vig = this.cam.postFX.addVignette(0.5, 0.5, 0.92, 0.32);
      this.post = true;
    } catch (e) { this.post = false; console.warn('postFX unavailable', e); }
  }
  setPost(on) {
    if (this.bloom) this.bloom.active = on;
    this.postOn = on;
  }
  setQuality(q) { this.q = q; this.qs = [0.4, 0.7, 1][q]; }

  // ------------------------------------------------------------ pooled fx sprites
  sprite(tex, x, y, o = {}) {
    if (this.fx.length > 420) return null;
    const im = this.imgs.get(tex);
    const r = { im, t: 0, dur: o.dur || 0.4, s0: o.s0 ?? 1, s1: o.s1 ?? 1, a0: o.a0 ?? 1, a1: o.a1 ?? 0, vx: o.vx || 0, vy: o.vy || 0, vr: o.vr || 0, ease: o.ease || 'out', sy: o.sy ?? 1, follow: o.follow || null, fx: o.fx || 0, fy: o.fy || 0 };
    im.setPosition(x, y).setDepth(o.depth ?? 192).setRotation(o.rot || 0).setTint(o.tint ?? 0xffffff);
    if (o.add !== false) im.setBlendMode(ADD);
    im.setScale(r.s0, r.s0 * r.sy).setAlpha(r.a0);
    this.fx.push(r); return r;
  }
  ring(x, y, R, tint = 0xffffff, dur = 0.35, a0 = 0.9) { return this.sprite('fx_ring', x, y, { s0: 0.12, s1: (R * 2) / 58, a0, a1: 0, dur, tint }); }
  disc(x, y, R, tint, dur = 0.4, a0 = 0.5) { return this.sprite('fx_disc', x, y, { s0: R * 1.6 / 64, s1: R * 2 / 64, a0, a1: 0, dur, tint, depth: 191 }); }
  glow(x, y, R, tint = 0xffffff, dur = 0.25, a0 = 1) { return this.sprite('fx_glow', x, y, { s0: R * 2 / 64 * 0.6, s1: R * 2 / 64, a0, a1: 0, dur, tint, depth: 193 }); }
  slash(x, y, ang, len, tint = 0xffffff, dur = 0.16) { return this.sprite('fx_slash', x, y, { s0: len / 48 * 0.6, s1: len / 48, rot: ang, a0: 1, a1: 0, dur, tint, sy: 0.7, depth: 193 }); }

  // ------------------------------------------------------------ bursts
  burstSpark(x, y, n, tint) { this._tint = tint; this.spark.explode(Math.ceil(n * this.qs), x, y); }
  hit(x, y, tint = 0xffffff, n = 4) {
    this._tint = tint; this.spark.explode(Math.ceil(n * this.qs), x, y);
    if (this.fx.length < 170) this.sprite('fx_star', x, y, { s0: 0.5, s1: 0.2, a0: 1, a1: 0, dur: 0.14, tint, rot: Math.random() * 3, depth: 194 });
  }
  puff(x, y, n = 1, tint = 0xcfc4a8) { this._tint = tint; this.smoke.explode(Math.ceil(n * this.qs) || 1, x, y); }
  die(x, y, tint, big = false) {
    const n = big ? 26 : 9;
    this._tint = tint; this.chunk.explode(Math.ceil(n * this.qs), x, y);
    this.spark.explode(Math.ceil(n * 0.7 * this.qs), x, y);
    this._tint = 0xb8b0a0; this.smoke.explode(Math.ceil((big ? 6 : 2) * this.qs), x, y);
    this.glow(x, y, big ? 38 : 13, tint, big ? 0.4 : 0.22, 0.9);
    if (big) { this.ring(x, y, 46, tint, 0.5); this.ring(x, y, 80, 0xffffff, 0.7, 0.6); }
  }
  boom(x, y, R, tint = 0xffa13a, o = {}) {
    const k = Math.min(2.4, R / 40), sc = this.qs;
    this.glow(x, y, R * 1.15, 0xfff2b0, 0.28, 1);
    this.disc(x, y, R, tint, 0.34, 0.55);
    this.ring(x, y, R * 1.05, tint, 0.38); if (R > 34) this.ring(x, y, R * 1.5, 0xffffff, 0.5, 0.5);
    this._tint = tint; this.glowp.explode(Math.ceil(6 * k * sc), x, y);
    this.spark.explode(Math.ceil(16 * k * sc), x, y);
    this._tint = 0xffd24a; this.ember.explode(Math.ceil(10 * k * sc), x, y);
    this._tint = o.chunk ?? 0x6a4a30; this.chunk.explode(Math.ceil(7 * k * sc), x, y);
    this._tint = 0x70685c; this.smoke.explode(Math.ceil(5 * k * sc), x, y);
    this.shake(o.shake ?? Math.min(0.5, 0.1 + R / 200));
  }
  trail(x, y, tint, n = 1) { this._tint = tint; this.glowp.explode(n, x, y); }
  fire(x, y, vx, vy, n = 1) { this._tint = 0xff8a2a; this.flame.explode(Math.ceil(n * this.qs) || 1, x, y); }

  // ------------------------------------------------------------ camera
  shake(a) { this.trauma = Math.min(1, this.trauma + a); }
  flashScreen(r, g, b, ms = 120) { this.cam.flash(ms, r, g, b); }

  // ------------------------------------------------------------ damage numbers
  num(x, y, val, kind = 'w', big = false) {
    if (this.nums.length > 26 && kind === 'w') return;
    const str = String(Math.max(1, Math.round(val))), prefix = kind === 'g' ? 'p' : null;
    const chars = (prefix ? [prefix] : []).concat([...str]);
    const ims = chars.map((ch) => { const im = this.imgs.get(`d_${kind}_${ch}`); im.setDepth(197); return im; });
    const n = { ims, x: x + (Math.random() - 0.5) * 6, y: y - 4, t: 0, dur: big ? 0.9 : 0.62, vy: -26 - Math.random() * 10, vx: (Math.random() - 0.5) * 18, s: big ? 1.5 : 0.95, w: chars.length };
    this.nums.push(n); this.layoutNum(n, 0.2);
  }
  layoutNum(n, u) {
    const s = n.s * (u < 0.18 ? 0.5 + 0.5 * pop(u / 0.18) * 1.15 : 1) * 0.5, step = 10 * n.s * 0.5, x0 = n.x - (n.w - 1) * step / 2;
    const a = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3;
    for (let i = 0; i < n.ims.length; i++) n.ims[i].setPosition(x0 + i * step, n.y).setScale(s).setAlpha(a);
  }

  // ------------------------------------------------------------ per frame
  update(dt) {
    // fx sprites
    const L = this.fx;
    for (let i = L.length - 1; i >= 0; i--) {
      const r = L[i]; r.t += dt; const u = r.t / r.dur;
      if (u >= 1) { this.imgs.put(r.im); L[i] = L[L.length - 1]; L.pop(); continue; }
      const e = r.ease === 'lin' ? u : r.ease === 'pop' ? pop(u) : easeOut(u);
      const s = r.s0 + (r.s1 - r.s0) * e;
      const im = r.im;
      im.setScale(s, s * r.sy).setAlpha(r.a0 + (r.a1 - r.a0) * u);
      if (r.follow) im.setPosition(r.follow.x + r.fx, r.follow.y + r.fy); else if (r.vx || r.vy) im.x += r.vx * dt, im.y += r.vy * dt;
      if (r.vr) im.rotation += r.vr * dt;
    }
    const N = this.nums;
    for (let i = N.length - 1; i >= 0; i--) {
      const n = N[i]; n.t += dt; const u = n.t / n.dur;
      if (u >= 1) { n.ims.forEach((im) => this.imgs.put(im)); N[i] = N[N.length - 1]; N.pop(); continue; }
      n.y += n.vy * dt; n.x += n.vx * dt; n.vy *= Math.exp(-dt * 3.2); n.vx *= Math.exp(-dt * 3);
      this.layoutNum(n, u);
    }
    // shake
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - dt * 1.9);
      const s = this.trauma * this.trauma * 7;
      this.ox = Math.round((Math.random() * 2 - 1) * s * 2) / 2; this.oy = Math.round((Math.random() * 2 - 1) * s * 2) / 2;
    } else { this.ox = this.oy = 0; }
    const B = this.bolts;
    if (B.length || this._gdirty) {
      const g = this.g; g.clear(); this._gdirty = B.length > 0;
      for (let i = B.length - 1; i >= 0; i--) {
        const b = B[i]; b.t += dt; if (b.t >= b.dur) { B[i] = B[B.length - 1]; B.pop(); continue; }
        b.re -= dt; if (b.re <= 0) { b.re = 0.045; this.jitter(b); }
        const fade = 1 - b.t / b.dur, pts = b.pts;
        for (const [lw, a, c] of [[b.w + 4, 0.2 * fade, b.tint], [b.w + 1.6, 0.55 * fade, b.tint], [b.w * 0.6, fade, 0xffffff]]) {
          g.lineStyle(lw, c, a).beginPath().moveTo(pts[0][0], pts[0][1]); for (let k = 1; k < pts.length; k++) g.lineTo(pts[k][0], pts[k][1]); g.strokePath();
        }
      }
    }
  }
  jitter(b) {
    const dx = b.x1 - b.x0, dy = b.y1 - b.y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, n = Math.max(3, Math.min(7, (l / 10) | 0));
    const pts = [[b.x0, b.y0]];
    for (let i = 1; i < n; i++) { const t = i / n, o = (Math.random() - 0.5) * 11; pts.push([b.x0 + dx * t + nx * o, b.y0 + dy * t + ny * o]); }
    pts.push([b.x1, b.y1]); b.pts = pts;
  }
  bolt(x0, y0, x1, y1, tint = 0xbfe8ff, w = 2, dur = 0.2) {
    if (this.bolts.length > 40) return;
    const b = { x0, y0, x1, y1, tint, w, t: 0, dur, re: 0.045, pts: null }; this.jitter(b); this.bolts.push(b);
  }
  destroy() { /* scene shutdown destroys children */ }
}

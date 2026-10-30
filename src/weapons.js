// Player weapons: 12 weapons + evolutions, projectile system, area helpers. Mixed into GameScene.prototype.
import { SC } from './sprites.js';
import { sfx } from './sfx.js';
import { WW, WH } from './world.js';
import { WEAPONS } from './defs.js';

const TAU = Math.PI * 2, rnd = Math.random;
const A = (x0, y0, x1, y1) => Math.atan2(y1 - y0, x1 - x0);

export const WeaponMethods = {
  // ---------------------------------------------------------------- helpers
  wdmg(w, base) { return base * this.P.dmg * (1 + w.bonus) * (1 + this.P.rage * (1 - this.hp / this.P.maxHp)); },
  wcd(w, base) { return base / this.P.rate; },
  nearest(x, y, maxD, skip) {
    let best = null, bd = maxD * maxD; const en = this.en;
    for (let i = 0; i < en.length; i++) { const e = en[i]; if (e.dead || e.inv || e === skip) continue; const d = (e.x - x) ** 2 + (e.y - y) ** 2; if (d < bd) { bd = d; best = e; } }
    return best;
  },
  /** live enemies within r (plus their radius), written into buf (default shared) */
  near(x, y, r, buf = this._qb) {
    buf.length = 0; const n = this.grid.query(x, y, r + 16), o = this.grid.out, en = this.en;
    for (let k = 0; k < n; k++) { const e = en[o[k]]; if (!e || e.dead || e.inv) continue; const rr = r + e.rad; if ((e.x - x) ** 2 + (e.y - y) ** 2 < rr * rr) buf.push(e); }
    return buf;
  },
  randomNear(x, y, maxD, n) {
    const out = [], en = this.en; if (!en.length) return out;
    for (let tries = 0; tries < 24 && out.length < n; tries++) { const e = en[(rnd() * en.length) | 0]; if (e.dead || e.inv || out.includes(e)) continue; if ((e.x - x) ** 2 + (e.y - y) ** 2 < maxD * maxD) out.push(e); }
    return out;
  },
  /** AoE blast: vfx + damage to enemies, optionally a fire zone */
  boom(x, y, R, dmg, o = {}) {
    this.vfx.boom(x, y, R, o.col ?? 0xffa13a, { shake: o.shake });
    sfx.boom();
    const list = this.near(x, y, R, o.buf || this._qc).slice();
    for (const e of list) { if (e.dead) continue; const d = Math.hypot(e.x - x, e.y - y) || 1; this.hurt(e, dmg * (1 - 0.3 * Math.min(1, d / (R + 1))), (e.x - x) / d * (o.kb ?? 110), (e.y - y) / d * (o.kb ?? 110), { col: o.col ?? 0xffa13a }); if (o.burn) this.ignite(e, o.burn); }
    if (o.fire) this.addZone('fire', x, y, o.fire, 2.6);
    this.hitStopFor(Math.min(0.045, R * 0.0009));
  },

  // ---------------------------------------------------------------- projectiles
  addPj(o) {
    if (this.pj.length > 380) return null;
    const p = Object.assign({ kind: 'line', x: this.px, y: this.py, vx: 0, vy: 0, life: 1, dmg: 1, r: 4, pierce: 0, spin: 0, sc: 1, col: 0xffffff, kb: 38, t: 0 }, o);
    p.hit = []; p.im = this.vfx.imgs.get(p.tex); p.im.setScale(SC * p.sc).setDepth(190).setPosition(p.x, p.y);
    if (p.add) p.im.setBlendMode(1);
    if (p.kind !== 'lob' && p.kind !== 'mine' && !p.noRot) p.im.setRotation(Math.atan2(p.vy, p.vx));
    this.pj.push(p); return p;
  },
  endPj(i) {
    const p = this.pj[i];
    if (p.onEnd) p.onEnd(this, p);
    this.vfx.imgs.put(p.im); const last = this.pj.pop(); if (i < this.pj.length) this.pj[i] = last;
  },
  updatePj(dt) {
    const pj = this.pj, en = this.en, g = this.grid, vfx = this.vfx;
    for (let i = pj.length - 1; i >= 0; i--) {
      const p = pj[i]; p.t += dt; p.life -= dt;
      if (p.kind === 'line') {
        if (p.home) {
          p.ht = (p.ht || 0) - dt; if (p.ht <= 0) { p.ht = 0.12; p.tg = this.nearest(p.x, p.y, 130); }
          if (p.tg && !p.tg.dead) { const sp = Math.hypot(p.vx, p.vy), want = A(p.x, p.y, p.tg.x, p.tg.y), cur = Math.atan2(p.vy, p.vx); let d = want - cur; d = Math.atan2(Math.sin(d), Math.cos(d)); const na = cur + Math.max(-dt * 6, Math.min(dt * 6, d)); p.vx = Math.cos(na) * sp; p.vy = Math.sin(na) * sp; p.im.setRotation(na); }
        }
        p.x += p.vx * dt; p.y += p.vy * dt;
      } else if (p.kind === 'boom') {
        const spd = p.spd; p.life = 5;
        if (p.state === 0) {
          p.x += p.vx * dt; p.y += p.vy * dt;
          if ((p.x - p.ox) ** 2 + (p.y - p.oy) ** 2 > p.maxD * p.maxD) { p.state = 1; p.hit.length = 0; if (p.evo) this.boom(p.x, p.y, 30 * this.P.area, p.dmg * 1.1, { col: 0xffd24a }); }
        } else {
          const dx = this.px - p.x, dy = this.py - p.y, l = Math.hypot(dx, dy) || 1; p.rs = Math.min(spd * 1.5, (p.rs || spd * 0.5) + 520 * dt);
          p.x += dx / l * p.rs * dt; p.y += dy / l * p.rs * dt;
          if (l < 9) { p.life = 0; if (p.evo) this.boom(this.px, this.py, 26 * this.P.area, p.dmg, { col: 0xffd24a }); }
        }
        p.im.rotation += 15 * dt;
        if (p.evo && rnd() < 0.5) vfx.trail(p.x, p.y, 0xffc83a, 1);
      } else if (p.kind === 'lob') {
        const u = Math.min(1, p.t / p.T); p.x = p.sx + (p.tx - p.sx) * u; p.y = p.sy + (p.ty - p.sy) * u - Math.sin(u * Math.PI) * p.h;
        p.im.rotation += (p.spin || 9) * dt;
        if (p.trailc && rnd() < 0.7) vfx.trail(p.x, p.y, p.trailc, 1);
        if (u >= 1) { p.life = 0; p.noHit = true; if (p.land) p.land(this, p); }
        p.life = Math.max(p.life, p.t >= p.T ? 0 : 0.05);
      } else if (p.kind === 'mine') {
        p.arm -= dt; p.im.setAlpha(p.arm > 0 ? 0.55 : 0.8 + Math.sin(p.t * 8) * 0.2);
        if (p.arm <= 0) { const n = this.near(p.x, p.y, 15, this._qa); if (n.length) { p.life = 0; this.mineBlast(p); } }
      }
      if (p.spin && p.kind === 'line') p.im.rotation += p.spin * dt;
      p.im.setPosition(p.x, p.y);
      if (p.trail && p.kind === 'line' && rnd() < 0.5) vfx.trail(p.x, p.y, p.trail, 1);
      if (!p.noHit && p.kind !== 'mine' && p.kind !== 'lob') {
        const n = g.query(p.x, p.y, p.r + 18), o = g.out, a = this._qa; a.length = 0;
        for (let k = 0; k < n; k++) a.push(o[k]);
        for (let k = 0; k < a.length; k++) {
          const e = en[a[k]]; if (!e || e.dead || e.inv) continue;
          const rr = p.r + e.rad; if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 > rr * rr) continue;
          if (p.hit.includes(e)) continue; p.hit.push(e);
          this.pjHit(p, e);
          if (p.pierce-- <= 0) { p.life = 0; break; }
        }
      }
      if (p.boss !== false && !p.noHit && p.kind !== 'mine' && p.kind !== 'lob') this.pjBoss(p);
      if (p.life <= 0 || p.x < -20 || p.y < -20 || p.x > WW + 20 || p.y > WH + 20) this.endPj(i);
    }
  },
  pjHit(p, e) {
    const l = Math.hypot(p.vx, p.vy) || 1;
    this.hurt(e, p.dmg, p.vx / l * p.kb, p.vy / l * p.kb, { col: p.col });
    if (p.slow) { e.slow = Math.max(e.slow, p.slowT || 2); e.slowF = Math.min(e.slowF, p.slow); }
    if (p.burn) this.ignite(e, p.burn);
    if (p.stun && rnd() < p.stun) this.freeze(e, 1.3);
    this.vfx.hit(e.x, e.y, p.col, 3);
    if (p.expl) this.boom(e.x, e.y, p.expl, p.dmg * 0.8, { col: p.col });
  },
  pjBoss() { /* bosses live in the same enemy array; nothing extra */ },
  mineBlast(p) {
    const w = p.w, L = w.lvl;
    this.boom(p.x, p.y, (30 + (L >= 2 ? 4 : 0) + (L >= 6 ? 5 : 0)) * this.P.area, p.dmg, { col: 0xff5a4a });
    if (w.evo) for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; this.addPj({ tex: 'pj_quill', x: p.x, y: p.y, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, life: 0.7, dmg: p.dmg * 0.45, pierce: 2, r: 3, sc: 1, col: 0xe0c8a0 }); }
  },

  // ---------------------------------------------------------------- weapon loop
  updateWeapons(dt) {
    const tg = this.tgt;
    for (const w of this.weapons) { w.cool = Math.max(0, w.cool - dt); WU[w.id](this, w, dt, tg); }
    this.updatePj(dt);
  },
  /** UI: remaining cooldown fraction for a weapon (0 ready .. 1 just fired) */
  wcdFrac(w) { return w.cdMax ? Math.max(0, Math.min(1, w.cd / w.cdMax)) : 0; },
  setCd(w, v) { w.cd = v; w.cdMax = v; },
  onWeaponAdd(w) { w.cool = 0; w.objs = []; w.ang = 0; },
  onWeaponChange(w, evo) {
    if (evo) { this.toast({ text: 'EVOLVED!', sub: WEAPONS[w.id].evo.name, color: '#ffb82e' }); this.vfx.flashScreen(255, 220, 120, 260); this.vfx.ring(this.px, this.py, 70, 0xffd24a, 0.7); this.vfx.glow(this.px, this.py, 60, 0xffd24a, 0.5); this.vfx.shake(0.35); }
  },
};

// ---- helpers for weapon fire
const c = (L, ...a) => a.filter((x) => L >= x).length;
function aimAt(g, tg) { return tg ? A(g.px, g.py, tg.x, tg.y) : g.aim; }
function ready(w, dt) { w.cd -= dt; return w.cd <= 0; }

const WU = {
  seed(g, w, dt) {
    if (!ready(w, dt)) return;
    const P = g.P, L = w.lvl, evo = w.evo;
    const t = g.nearest(g.px, g.py, 190 * P.pspeed); if (!t) { w.cd = 0.05; return; }
    const n = 1 + c(L, 3, 7) + P.amount + (evo ? 2 : 0);
    g.setCd(w, 0.42 / (P.rate * (1 + 0.2 * c(L, 4, 8))));
    const base = A(g.px, g.py, t.x, t.y), dmg = g.wdmg(w, 2.2 * (1 + 0.25 * c(L, 2, 6)));
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.17, sp = 215 * P.pspeed;
      g.addPj({ tex: evo ? 'pj_nut' : 'seed', x: g.px + Math.cos(a) * 8, y: g.py + Math.sin(a) * 8 - 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1.15 * P.dur, dmg, pierce: 1 + c(L, 5, 8) + P.pierce + (evo ? 2 : 0), r: 4 * P.size, sc: P.size * (evo ? 0.8 : 1), home: evo, col: evo ? 0xffd24a : 0xf2d070, trail: evo ? 0xffc83a : null });
    }
    w.n = (w.n || 0) + 1;
    if (evo && w.n % 4 === 0) { for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; g.addPj({ tex: 'seed', x: g.px, y: g.py, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170, life: 0.75, dmg: dmg * 0.7, pierce: 2, r: 4, col: 0xffd24a }); } g.vfx.ring(g.px, g.py, 40, 0xffd24a, 0.4); }
    g.recoil(base); sfx.shoot();
  },

  blades(g, w, dt) {
    const P = g.P, L = w.lvl, evo = w.evo;
    const n1 = 1 + c(L, 2, 5, 7, 8) + P.amount, n2 = evo ? n1 + 1 : 0, total = n1 + n2;
    while (w.objs.length < total) { const im = g.vfx.imgs.get('blade'); im.setDepth(191); w.objs.push(im); }
    while (w.objs.length > total) g.vfx.imgs.put(w.objs.pop());
    w.ang += dt * (3.3 + (L >= 6 ? 1 : 0)) * P.pspeed * (evo ? 1.3 : 1);
    const R = (28 + (L >= 4 ? 8 : 0)) * P.area, dmg = g.wdmg(w, 1.5 * (1 + 0.25 * c(L, 3, 6)));
    for (let i = 0; i < total; i++) {
      const outer = i >= n1, k = outer ? i - n1 : i, cnt = outer ? n2 : n1, a = (outer ? -w.ang * 0.8 : w.ang) + k / cnt * TAU, rr = outer ? R * 1.75 : R;
      const im = w.objs[i], x = g.px + Math.cos(a) * rr, y = g.py + 1 + Math.sin(a) * rr;
      im.setPosition(x, y).setRotation(a * 3).setScale(SC * (evo ? 1.25 : 1) * P.size);
      if (evo) { im.setTint(0xffa060); if (rnd() < 0.5) g.vfx.fire(x, y, 0, 0, 1); } else im.clearTint();
      const list = g.near(x, y, 9 * P.size * (evo ? 1.2 : 1), g._qa);
      for (const e of list) { if (e.bt > 0 || e.dead) continue; e.bt = 0.36; const d = Math.hypot(e.x - g.px, e.y - g.py) || 1; g.hurt(e, dmg, (e.x - g.px) / d * 70, (e.y - g.py) / d * 70, { col: evo ? 0xff8a3a : 0xdfe6f0 }); if (evo) g.ignite(e, dmg * 0.6); g.vfx.hit(x, y, evo ? 0xff9a4a : 0xffffff, 3); sfx.hit(); }
    }
    if (evo && (w.fireT = (w.fireT || 0) - dt) <= 0) { w.fireT = 0.38; g.addZone('fire', g.px, g.py + 2, 11, 1.8); }
  },

  wave(g, w, dt) {
    if (!ready(w, dt)) return;
    const P = g.P, L = w.lvl, evo = w.evo;
    if (!g.en.length) { w.cd = 0.1; return; }
    g.setCd(w, 4.6 * Math.pow(0.88, c(L, 4, 7)) / P.rate * (evo ? 0.85 : 1));
    const kb = 140 + (L >= 8 ? 80 : 0);
    const fire = (R, dmg) => {
      sfx.nova();
      g.vfx.ring(g.px, g.py, R, evo ? 0xffc83a : 0xffe066, 0.5); g.vfx.disc(g.px, g.py, R, evo ? 0xffa030 : 0xffd23f, 0.45, 0.55); g.vfx.glow(g.px, g.py, R * 0.5, 0xfff2a0, 0.3);
      g.vfx.ring(g.px, g.py, R * 0.7, 0xffffff, 0.35, 0.5); g.vfx.shake(0.12);
      const list = g.near(g.px, g.py, R, g._qc).slice();
      for (const e of list) { const d = Math.hypot(e.x - g.px, e.y - g.py) || 1; g.hurt(e, dmg, (e.x - g.px) / d * kb, (e.y - g.py) / d * kb, { col: 0xffd23f }); if (evo) { e.slow = Math.max(e.slow, 1.2); e.slowF = Math.min(e.slowF, 0.5); } }
      g.clearEnemyShots(g.px, g.py, R);
      if (evo) g.addZone('cheese', g.px + (rnd() - 0.5) * R * 0.5, g.py + (rnd() - 0.5) * R * 0.5, R * 0.42, 4.5);
    };
    const R = (50 + 8 * c(L, 2, 5, 8)) * P.area, dmg = g.wdmg(w, 3.4 * (1 + 0.25 * c(L, 3, 6)));
    fire(R, dmg); if (evo) g.later(0.32, () => fire(R * 1.4, dmg * 0.8));
  },

  bomb(g, w, dt) {
    if (!ready(w, dt)) return;
    const P = g.P, L = w.lvl, evo = w.evo;
    const n = 1 + c(L, 2, 5, 8) + P.amount;
    const tgs = g.randomNear(g.px, g.py, 220, n); if (!tgs.length) { w.cd = 0.15; return; }
    g.setCd(w, 2.6 * (L >= 4 ? 0.9 : 1) / P.rate);
    const R = (30 + 5 * c(L, 3, 7)) * P.area, dmg = g.wdmg(w, 6.5 * (1 + 0.25 * c(L, 6)));
    tgs.forEach((t, i) => {
      g.later(i * 0.1, () => {
        const tx = t.x + (rnd() - 0.5) * 10, ty = t.y + (rnd() - 0.5) * 10;
        g.addPj({ kind: 'lob', tex: 'bomb', sx: g.px, sy: g.py - 4, x: g.px, y: g.py - 4, tx, ty, T: 0.5 + i * 0.03, h: 40, noHit: true, life: 5, trailc: 0xffc060,
          land: (gg) => { gg.boom(tx, ty, R, dmg, { col: 0xffa13a }); if (evo) for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + rnd(), d = 26 + rnd() * 16; const mx = tx + Math.cos(a) * d, my = ty + Math.sin(a) * d; gg.addPj({ kind: 'lob', tex: 'pj_minin', sx: tx, sy: ty, x: tx, y: ty, tx: mx, ty: my, T: 0.4, h: 22, noHit: true, life: 3, spin: 12, land: (g3) => g3.boom(mx, my, R * 0.55, dmg * 0.5, { col: 0xffc060, shake: 0.05 }) }); } } });
      });
    });
    sfx.shoot();
  },

  boomerang(g, w, dt) {
    if (!ready(w, dt)) return;
    const P = g.P, L = w.lvl, evo = w.evo;
    const t = g.nearest(g.px, g.py, 200); if (!t) { w.cd = 0.1; return; }
    const n = evo ? 1 + P.amount : 1 + c(L, 3, 7) + P.amount;
    g.setCd(w, 1.9 * (L >= 4 ? 0.9 : 1) / P.rate);
    const base = A(g.px, g.py, t.x, t.y), dmg = g.wdmg(w, 3.6 * (1 + 0.25 * c(L, 2, 6)) * (evo ? 1.5 : 1));
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.35, sp = 190 * P.pspeed;
      const p = g.addPj({ kind: 'boom', tex: 'pj_nut', x: g.px, y: g.py, ox: g.px, oy: g.py, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, spd: sp, state: 0, maxD: (120 + (L >= 5 ? 35 : 0)) * P.dur, life: 6, dmg, pierce: 999, r: (6 + (L >= 8 ? 2 : 0) + (evo ? 5 : 0)) * P.size, sc: (1 + (L >= 8 ? 0.2 : 0) + (evo ? 0.9 : 0)) * P.size, evo, kb: 60, col: 0xffc83a, noRot: true });
      if (p && evo) p.im.setTint(0xffe27a);
    }
    sfx.shoot();
  },

  lightning(g, w, dt) {
    const P = g.P, L = w.lvl, evo = w.evo;
    const strike = (t0, dmg, chains) => {
      let from = { x: t0.x + (rnd() - 0.5) * 30, y: t0.y - 90 }, cur = t0; const hit = [];
      for (let k = 0; k <= chains; k++) {
        if (!cur || cur.dead) break;
        hit.push(cur); g.vfx.bolt(from.x, from.y, cur.x, cur.y - 2, evo ? 0xd7a8ff : 0xbfe8ff, k === 0 ? 3 : 2);
        const dm = dmg * Math.pow(0.88, k); g.hurt(cur, dm, 0, 0, { col: 0xbfe8ff }); g.vfx.hit(cur.x, cur.y, 0xbfe8ff, 5); g.vfx.glow(cur.x, cur.y, 14, 0xbfe8ff, 0.2);
        if (evo) cur.stun = Math.max(cur.stun, 0.4);
        from = { x: cur.x, y: cur.y - 2 };
        const cand = g.near(cur.x, cur.y, evo ? 75 : 58, g._qa); let nx = null, bd = 1e9;
        for (const e of cand) { if (hit.includes(e) || e.dead) continue; const d = (e.x - cur.x) ** 2 + (e.y - cur.y) ** 2; if (d < bd) { bd = d; nx = e; } }
        cur = nx;
      }
      sfx.nova();
    };
    if (ready(w, dt)) {
      const n = 1 + c(L, 4, 8) + P.amount + (evo ? 2 : 0);
      const tgs = g.randomNear(g.px, g.py, 190, n); if (!tgs.length) { w.cd = 0.15; return; }
      g.setCd(w, 2.1 * (L >= 5 ? 0.9 : 1) / P.rate * (evo ? 0.7 : 1));
      const dmg = g.wdmg(w, 4.2 * (1 + 0.25 * c(L, 3, 7)) * (evo ? 1.2 : 1)), chains = 2 + c(L, 2, 6) + (evo ? 3 : 0);
      tgs.forEach((t, i) => g.later(i * 0.08, () => { if (!t.dead) strike(t, dmg, chains); }));
    }
    if (evo) { w.mini = (w.mini || 0) - dt; if (w.mini <= 0) { w.mini = 0.4; const t = g.randomNear(g.px, g.py, 170, 1)[0]; if (t) strike(t, g.wdmg(w, 3), 2); } }
  },

  flame(g, w, dt) {
    const P = g.P, L = w.lvl, evo = w.evo;
    const range = (50 + 7 * c(L, 2, 6)) * P.area * (evo ? 1.4 : 1), half = 0.4 + 0.14 * c(L, 4, 8) + (evo ? 0.22 : 0);
    const t = g.nearest(g.px, g.py, range * 1.15);
    if (!t) { w.on = false; return; }
    const want = A(g.px, g.py, t.x, t.y); let d = want - (w.fa ?? want); d = Math.atan2(Math.sin(d), Math.cos(d)); w.fa = (w.fa ?? want) + d * Math.min(1, dt * 10);
    const fa = w.fa; w.on = true;
    w.fx = (w.fx || 0) - dt;
    if (w.fx <= 0) {
      w.fx = 0.03;
      for (let i = 0; i < (evo ? 3 : 2); i++) { const a = fa + (rnd() - 0.5) * half * 1.6, d0 = 8 + rnd() * range * 0.85; g.vfx.sprite('fx_flame', g.px + Math.cos(a) * d0, g.py + Math.sin(a) * d0 - 2, { s0: 0.4, s1: 0.95 + (evo ? 0.2 : 0), a0: 0.85, a1: 0, dur: 0.28, tint: evo ? (rnd() < 0.5 ? 0xff5a2a : 0xffc040) : (rnd() < 0.5 ? 0xff7a2a : 0xffd24a), vy: -22, depth: 192 }); }
    }
    w.tick = (w.tick || 0) - dt;
    if (w.tick <= 0) {
      w.tick = 0.12 / Math.min(2, P.rate);
      const dmg = g.wdmg(w, 1.0 * (1 + 0.25 * c(L, 3, 7)) * (evo ? 1.3 : 1)), list = g.near(g.px, g.py, range, g._qa);
      for (const e of list) { let da = Math.atan2(e.y - g.py, e.x - g.px) - fa; da = Math.atan2(Math.sin(da), Math.cos(da)); const slack = Math.atan2(e.rad, Math.hypot(e.x - g.px, e.y - g.py) + 1); if (Math.abs(da) > half + slack) continue; g.hurt(e, dmg, Math.cos(fa) * 8, Math.sin(fa) * 8, { dot: 1, col: 0xff8a2a }); g.ignite(e, dmg * 3 * (L >= 5 ? 1.25 : 1)); }
      if (evo) { w.zt = (w.zt || 0) - 0.12; if (w.zt <= 0) { w.zt = 0.45; const d0 = range * (0.35 + rnd() * 0.55); g.addZone('fire', g.px + Math.cos(fa) * d0, g.py + Math.sin(fa) * d0, 12, 2.6); } }
    }
  },

  frost(g, w, dt) {
    const P = g.P, L = w.lvl, evo = w.evo;
    if (evo) {
      w.auraT = (w.auraT || 0) - dt;
      if (w.auraT <= 0) {
        w.auraT = 0.3; const R = 62 * P.area, list = g.near(g.px, g.py, R, g._qa); g.vfx.ring(g.px, g.py, R, 0xbfeaff, 0.5, 0.35); g.vfx.disc(g.px, g.py, R, 0x9fdcff, 0.35, 0.2);
        for (const e of list) { e.slow = Math.max(e.slow, 0.8); e.slowF = Math.min(e.slowF, 0.5); g.hurt(e, g.wdmg(w, 0.8), 0, 0, { dot: 1, col: 0xbfeaff }); }
        for (let i = 0; i < 3; i++) { const a = rnd() * TAU, r = rnd() * R; g.vfx.sprite('fx_dot', g.px + Math.cos(a) * r, g.py + Math.sin(a) * r, { s0: 1.4, s1: 0.2, a0: 0.9, a1: 0, dur: 0.8, tint: 0xdff6ff, vy: 12, vx: -8 }); }
      }
    }
    if (!ready(w, dt)) return;
    if (!g.en.length) { w.cd = 0.15; return; }
    const n = 4 + 2 * c(L, 2, 6) + 2 * P.amount + (evo ? 4 : 0);
    g.setCd(w, 3.1 * (L >= 4 ? 0.9 : 1) / P.rate);
    const dmg = g.wdmg(w, 2.4 * (1 + 0.25 * c(L, 3, 7))), off = rnd() * TAU;
    for (let i = 0; i < n; i++) { const a = off + i / n * TAU, sp = 120 * P.pspeed; g.addPj({ tex: 'pj_snow', x: g.px, y: g.py, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1.0 * P.dur, dmg, pierce: 1 + P.pierce, r: 5 * P.size, sc: P.size, slow: 0.45, slowT: 2.2, stun: 0.1 + 0.12 * c(L, 5, 8), col: 0xbfeaff, trail: 0xbfeaff, home: evo, noRot: true, spin: 6 }); }
    g.vfx.ring(g.px, g.py, 26, 0xbfeaff, 0.3); sfx.nova();
  },

  mines(g, w, dt) {
    if (!ready(w, dt)) return;
    const P = g.P, L = w.lvl;
    const cap = 3 + c(L, 2, 6, 8) + P.amount * 2, cnt = g.pj.reduce((s, p) => s + (p.kind === 'mine' && p.w === w ? 1 : 0), 0);
    if (cnt >= cap || !g.en.length) { w.cd = 0.3; return; }
    g.setCd(w, 2.2 * (L >= 4 ? 0.9 : 1) / P.rate);
    const dmg = g.wdmg(w, 8 * (1 + 0.25 * c(L, 5))), a = rnd() * TAU, d = 6 + rnd() * 14;
    const p = g.addPj({ kind: 'mine', tex: 'pj_mine', x: g.px + Math.cos(a) * d, y: g.py + Math.sin(a) * d + 4, arm: 0.6, life: 28, dmg, w, noRot: true, sc: 0.9 });
    if (p) { g.vfx.sprite('fx_ring', p.x, p.y, { s0: 0.1, s1: 0.45, a0: 0.8, a1: 0, dur: 0.3, tint: 0xff5a4a }); p.im.setDepth(5); }
  },

  bees(g, w, dt) {
    const P = g.P, L = w.lvl, evo = w.evo;
    const n = Math.min(10, 1 + c(L, 2, 4, 7, 8) + P.amount + (evo ? 3 : 0));
    while (w.objs.length < n) { const im = g.vfx.imgs.get('pj_bee'); im.setDepth(191); w.objs.push(im); im.b = { st: 0, a: rnd() * TAU, cd: rnd() * 0.5, tg: null, x: g.px, y: g.py, vx: 0, vy: 0 }; }
    while (w.objs.length > n) g.vfx.imgs.put(w.objs.pop());
    const dmg = g.wdmg(w, 2.6 * (1 + 0.25 * c(L, 3, 6)) * (evo ? 1.4 : 1)), dive = 170 * (L >= 5 ? 1.25 : 1) * P.pspeed;
    w.objs.forEach((im, i) => {
      const b = im.b; b.cd -= dt; b.a += dt * 2.2;
      const ox = g.px + Math.cos(b.a + i * TAU / n) * (24 + Math.sin(g.t * 3 + i) * 4), oy = g.py - 6 + Math.sin(b.a + i * TAU / n) * 18;
      let tx = ox, ty = oy, sp = 130;
      if (b.st === 0) {
        if (b.cd <= 0) { const t = g.nearest(g.px, g.py, 150 * P.area); if (t) { b.tg = t; b.st = 1; b.t = 0; } }
      } else if (b.st === 1) {
        if (!b.tg || b.tg.dead) { b.st = 0; b.cd = 0.2; } else {
          tx = b.tg.x; ty = b.tg.y; sp = dive; b.t += dt;
          if ((b.x - tx) ** 2 + (b.y - ty) ** 2 < (b.tg.rad + 6) ** 2) {
            g.hurt(b.tg, dmg, (tx - b.x) * 2, (ty - b.y) * 2, { col: 0xffe14a }); g.vfx.hit(tx, ty, 0xffe14a, 3); sfx.hit();
            if (evo && rnd() < 0.2) g.addZone('honey', tx, ty, 14, 3.2);
            b.st = 2; b.cd = 0.5 / P.rate; b.tg = null;
          } else if (b.t > 1.6) { b.st = 2; b.cd = 0.4; }
        }
      }
      if (b.st === 2) { sp = 190; if ((b.x - ox) ** 2 + (b.y - oy) ** 2 < 100) b.st = 0; }
      const dx = tx - b.x, dy = ty - b.y, l = Math.hypot(dx, dy) || 1, k = Math.min(1, dt * (b.st === 1 ? 14 : 6));
      b.vx += (dx / l * sp - b.vx) * k; b.vy += (dy / l * sp - b.vy) * k;
      if (b.st === 0 && l < 6) { b.vx *= 0.8; b.vy *= 0.8; }
      b.x += b.vx * dt; b.y += b.vy * dt;
      im.setPosition(b.x, b.y + Math.sin(g.t * 30 + i) * 0.8).setFlipX(b.vx < 0).setScale(SC * (evo ? 1.25 : 1));
      if (evo) im.setTint(0xffd24a); else im.clearTint();
      if (b.st === 1 && rnd() < 0.4) g.vfx.trail(b.x, b.y, 0xffe14a, 1);
    });
  },

  meteor(g, w, dt) {
    if (!ready(w, dt)) return;
    const P = g.P, L = w.lvl, evo = w.evo;
    const n = evo ? 7 + P.amount : 1 + c(L, 5, 8) + P.amount;
    const tgs = g.randomNear(g.px, g.py, 210, n); if (!tgs.length) { w.cd = 0.15; return; }
    g.setCd(w, 4.2 * (L >= 4 ? 0.9 : 1) / P.rate * (evo ? 1.15 : 1));
    const R = (30 + 5 * c(L, 2, 7)) * P.area * (evo ? 0.8 : 1), dmg = g.wdmg(w, 11 * (1 + 0.25 * c(L, 3, 6)) * (evo ? 0.65 : 1));
    for (let i = 0; i < n; i++) {
      const t = tgs[i % tgs.length], tx = t.x + (evo ? (rnd() - 0.5) * 70 : 0), ty = t.y + (evo ? (rnd() - 0.5) * 50 : 0), del = i * (evo ? 0.13 : 0.2);
      g.later(del, () => {
        g.vfx.sprite('fx_disc', tx, ty, { s0: R * 1.5 / 64, s1: R * 2 / 64, a0: 0.15, a1: 0.6, dur: 0.6, tint: 0xff4a2a, depth: 4, ease: 'lin' });
        g.vfx.sprite('fx_ring', tx, ty, { s0: R * 2 / 58, s1: R * 1.6 / 58, a0: 0.9, a1: 0.9, dur: 0.6, tint: 0xff7a4a, depth: 4, ease: 'lin' });
        g.later(0.55, () => g.addPj({ kind: 'lob', tex: 'pj_meteor', sx: tx + 70, sy: ty - 190, x: tx + 70, y: ty - 190, tx, ty, T: 0.42, h: 0, noHit: true, life: 5, spin: 3, trailc: 0xff8a3a, sc: 0.9, land: (gg) => gg.boom(tx, ty, R, dmg, { col: 0xff7a2a, fire: evo ? 13 : 0, shake: evo ? 0.15 : 0.3, kb: 140 }) }));
      });
    }
    sfx.nova();
  },

  beam(g, w, dt) {
    const P = g.P, L = w.lvl, evo = w.evo, B = w.beam;
    if (!B) {
      if (!ready(w, dt)) return;
      const t = g.nearest(g.px, g.py, 170); if (!t) { w.cd = 0.1; return; }
      const dur = evo ? 1.7 : 0.9, cnt = evo ? 3 : 1;
      w.beam = { t: 0, dur, ang: A(g.px, g.py, t.x, t.y), ims: [], tick: 0, cnt };
      for (let i = 0; i < cnt; i++) { const im = g.vfx.imgs.get('fx_beam'); im.setBlendMode(1).setDepth(192); w.beam.ims.push(im); }
      g.setCd(w, 3.4 * Math.pow(0.9, c(L, 4, 8)) / P.rate);
      g.vfx.shake(0.12); sfx.nova(); return;
    }
    B.t += dt; const u = B.t / B.dur;
    const len = (125 + 25 * c(L, 3, 7)) * P.area * (evo ? 1.4 : 1), wid = (5 + (L >= 5 ? 2.5 : 0)) * (evo ? 1.4 : 1), fade = u < 0.12 ? u / 0.12 : u > 0.8 ? Math.max(0, (1 - u) / 0.2) : 1;
    const t = g.nearest(g.px, g.py, len + 30);
    if (t) { let d = A(g.px, g.py, t.x, t.y) - B.ang; d = Math.atan2(Math.sin(d), Math.cos(d)); B.ang += d * Math.min(1, dt * (evo ? 2.5 : 4)); }
    if (evo) B.ang += dt * 0.9;
    const dmg = g.wdmg(w, 1.7 * (1 + 0.25 * c(L, 2, 6)) * (evo ? 1.2 : 1)), cols = evo ? [0xff5aa0, 0x5aff9a, 0x5aa8ff] : [0x7fe8ff];
    for (let i = 0; i < B.cnt; i++) {
      const a = B.ang + (B.cnt > 1 ? (i - 1) * 0.6 : 0), im = B.ims[i], cx = g.px + Math.cos(a) * len / 2, cy = g.py + Math.sin(a) * len / 2;
      im.setPosition(cx, cy).setRotation(a).setScale(len / 64, wid * (1 + Math.sin(g.t * 40) * 0.12) / 16 * 1.6).setTint(cols[i % cols.length]).setAlpha(fade);
      if (rnd() < 0.5) g.vfx.sprite('fx_dot', g.px + Math.cos(a) * rnd() * len, g.py + Math.sin(a) * rnd() * len, { s0: 1.2, s1: 0, a0: 1, a1: 0, dur: 0.3, tint: cols[i % cols.length], vx: (rnd() - 0.5) * 40, vy: (rnd() - 0.5) * 40 });
      if (B.tick <= 0) {
        const dx = Math.cos(a), dy = Math.sin(a), list = g.near(g.px + dx * len / 2, g.py + dy * len / 2, len / 2 + 4, g._qa);
        for (const e of list) { const rx = e.x - g.px, ry = e.y - g.py, al = rx * dx + ry * dy; if (al < 0 || al > len) continue; const pd = Math.abs(rx * dy - ry * dx); if (pd < wid + e.rad) { g.hurt(e, dmg, dx * 10, dy * 10, { dot: 1, col: cols[i % cols.length] }); g.vfx.hit(e.x, e.y, cols[i % cols.length], 1); } }
      }
    }
    if (B.tick <= 0) B.tick = 0.1; else B.tick -= dt;
    if (u >= 1) { B.ims.forEach((im) => g.vfx.imgs.put(im)); w.beam = null; }
  },
};
export { WU };

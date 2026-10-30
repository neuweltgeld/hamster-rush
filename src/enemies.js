// Enemies: spawning, AI behaviours, elites, bosses, enemy projectiles, hazard zones, spawn director. Mixed into GameScene.prototype.
import Phaser from 'phaser';
import { ENEMIES, AFFIX, BOSS_SCHEDULE } from './defs.js';
import { SC } from './sprites.js';
import { sfx } from './sfx.js';
import { emit } from './bus.js';
import { WW, WH } from './world.js';

const TAU = Math.PI * 2, rnd = Math.random;
const popE = (u) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); };
const C = { dx: 0, dy: 0, l: 1, nx: 0, ny: 0, vx: 0, vy: 0 }; // shared AI context (no allocs)
export const MAX_EN = 240;

const SWARMS = [[40, 'ant', 20], [65, 'rat', 18], [110, 'bat', 18], [140, 'beetle', 28], [165, 'bee', 18], [215, 'snake', 20], [240, 'ant', 36], [255, 'crow', 10], [300, 'rat', 34]];

export function prepEnemyDefs(scene) {
  for (const k in ENEMIES) {
    const D = ENEMIES[k]; D.id = k;
    D.t0 = scene.textures.exists(D.tex + '_w0') ? D.tex + '_w0' : D.tex;
    D.anim = scene.anims.exists(D.tex + '_walk') ? D.tex + '_walk' : null;
    D.scl = D.sc ?? 1;
  }
}

export const EnemyMethods = {
  // ------------------------------------------------------------ scheduling / telegraphs
  later(d, fn) { this.laterQ.push({ t: d, fn }); },
  runLater(dt) {
    const q = this.laterQ;
    for (let i = q.length - 1; i >= 0; i--) { const o = q[i]; o.t -= dt; if (o.t <= 0) { q.splice(i, 1); try { o.fn(this); } catch (e) { console.error(e); } } }
  },
  toast(t) { emit('toast', t); },
  teleDisc(x, y, R, dur, tint = 0xff4a3a) {
    this.vfx.sprite('fx_disc', x, y, { s0: R * 1.9 / 64, s1: R * 2 / 64, a0: 0.2, a1: 0.85, dur, tint, depth: 4, ease: 'lin', add: false });
    this.vfx.sprite('fx_ring', x, y, { s0: R * 2.3 / 58, s1: R * 2 / 58, a0: 0.9, a1: 0.9, dur, tint: 0xffa090, depth: 4, ease: 'lin' });
  },
  teleLine(x0, y0, x1, y1, w, dur, tint = 0xff4a3a) {
    const l = Math.hypot(x1 - x0, y1 - y0), a = Math.atan2(y1 - y0, x1 - x0);
    this.vfx.sprite('fx_beam', (x0 + x1) / 2, (y0 + y1) / 2, { s0: l / 64, sy: (w / 16) / (l / 64), a0: 0.15, a1: 0.8, dur, tint, rot: a, depth: 4, ease: 'lin' });
  },

  // ------------------------------------------------------------ enemy sprites / spawn
  getEnemySprite() {
    let e = this.epool.pop();
    if (!e) { e = this.add.sprite(0, 0, 'rat_w0'); }
    e.setActive(true).setVisible(true).clearTint().setAlpha(1).setRotation(0).setFlipX(false).setBlendMode(0);
    return e;
  },
  spawnEnemy(kind, x, y, o = {}) {
    const D = ENEMIES[kind];
    if (this.en.length >= MAX_EN && !D.boss) return null;
    const e = this.getEnemySprite();
    e.setTexture(D.t0).setPosition(x, y);
    if (D.anim) e.anims.play({ key: D.anim, startFrame: (rnd() * 8) | 0 }); else e.anims.stop();
    const t = this.t, elite = o.elite || null;
    e.d = D; e.kind = kind; e.uid = ++this.uidc; e.dead = false; e.inv = false; e.noTouch = false;
    const hm = (1 + t / 130) * (o.hp || 1) * (elite ? 7 : 1) * (elite && AFFIX[elite].hp ? AFFIX[elite].hp : 1);
    e.hp = e.mhp = D.hp * hm;
    e.spd = D.spd * (0.9 + rnd() * 0.25) * (elite && AFFIX[elite].spd ? AFFIX[elite].spd : 1);
    e.dmg = D.dmg * (1 + t / 240 * 0.6) * (elite ? 1.25 : 1);
    e.armor = elite && AFFIX[elite].armor ? AFFIX[elite].armor : 0;
    e.elite = elite; e.sc = D.scl * (elite ? 1.3 : 1); e.bs = SC * e.sc; e.rad = D.r * e.sc;
    e.kx = e.ky = 0; e.bt = 0; e.flash = 0; e.ph = rnd() * 6; e.age = 0; e.popDone = 0; e.keepAlpha = 0; e.sxm = e.sym = undefined; e.fuseOn = 0; e.sq = 0; e.slow = 0; e.slowF = 1; e.stun = 0; e.burn = 0; e.burnT = 0; e.burnD = 0; e.tstate = 0;
    e.st = ''; e.stt = (D.ai === 'cat' || D.ai === 'mole' || D.ai === 'hedge' || D.ai === 'skunk') ? 1 + rnd() * 2 : 1 + rnd() * 1.5; e.face = 1; e.hop = 0; e.swT = 0; e.dust = 0; e.aura = null; e.phase = 0;
    e.setScale(e.bs * 0.3).setAlpha(0.2); e.anims.timeScale = 1;
    if (elite) {
      const im = this.vfx.imgs.get('fx_glow'); im.setBlendMode(1).setTint(AFFIX[elite].tint).setDepth(99).setAlpha(0.7); e.aura = im;
      this.vfx.ring(x, y, 40, AFFIX[elite].tint, 0.5);
    }
    e.i = this.en.length; this.en.push(e);
    if (D.boss) { this.bosses.push(e); e.hmaxBoss = e.mhp; }
    return e;
  },
  freePoint(x, y, r) {
    x = Phaser.Math.Clamp(x, 10, WW - 10); y = Phaser.Math.Clamp(y, 10, WH - 10);
    const o = this.world.resolve(x, y + 3, r); x = o[0]; y = o[1] - 3;
    return this.world.deep(x, y + 3) ? null : [x, y];
  },
  spawnPos(r, d0 = 285, d1 = 325) {
    for (let i = 0; i < 8; i++) {
      const a = rnd() * TAU, d = d0 + rnd() * (d1 - d0), x = this.px + Math.cos(a) * d, y = this.py + Math.sin(a) * d;
      if (x < 12 || y < 12 || x > WW - 12 || y > WH - 12) continue;
      if (!r || !this.world.blocked(x, y + 3, r)) return [x, y];
    }
    return null;
  },
  spawnRing(kind, n, radius = 250) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, D = ENEMIES[kind], pt = this.freePoint(this.px + Math.cos(a) * radius, this.py + Math.sin(a) * radius, D.fly ? 0 : D.r);
      if (pt) this.spawnEnemy(kind, pt[0], pt[1]);
    }
  },
  buildGrid() { const g = this.grid, en = this.en; g.clear(); for (let i = 0; i < en.length; i++) { const e = en[i]; if (!e.dead) g.add(i, e.x, e.y); } },
  /** remove dead enemies (swap-compact) once per frame */
  reap() {
    const en = this.en; let j = 0;
    for (let i = 0; i < en.length; i++) {
      const e = en[i];
      if (e.dead) {
        e.setActive(false).setVisible(false); e.anims.stop(); if (e.aura) { this.vfx.imgs.put(e.aura); e.aura = null; }
        this.epool.push(e);
      } else { e.i = j; en[j++] = e; }
    }
    en.length = j;
    for (let i = this.bosses.length - 1; i >= 0; i--) if (this.bosses[i].dead) this.bosses.splice(i, 1);
  },
  ignite(e, dps) { if (e.d.boss) dps *= 0.6; e.burn = 2.4; e.burnD = Math.max(e.burnD, dps); },
  freeze(e, t) { if (e.d.boss) t *= 0.25; e.stun = Math.max(e.stun, t); this.vfx.hit(e.x, e.y, 0xbfeaff, 6); },

  // ------------------------------------------------------------ damage
  hurt(e, dmg, kx = 0, ky = 0, o = {}) {
    if (e.dead || e.inv) return false;
    let crit = false;
    if (!o.dot && !o.nocrit && rnd() < this.P.crit) { dmg *= 2; crit = true; }
    dmg *= 1 - e.armor; e.hp -= dmg; e.flash = 0.075; e.sq = Math.min(0.32, e.sq + 0.22);
    const kk = e.d.boss ? 0.05 : e.elite ? 0.35 : 1;
    e.kx += kx * kk; e.ky += ky * kk;
    if (!o.dot || rnd() < 0.18) this.vfx.num(e.x, e.y - e.rad - 2, dmg, crit ? 'y' : o.dot ? 'o' : 'w', crit);
    if (crit) { this.vfx.hit(e.x, e.y, 0xffe066, 5); this.hitStopFor(0.03); }
    if (!o.dot) sfx.hit();
    this.dealt += dmg;
    if (e.hp <= 0) { this.kill(e); return true; }
    return false;
  },
  kill(e, o = {}) {
    if (e.dead) return; e.dead = true;
    const D = e.d, P = this.P, x = e.x, y = e.y;
    this.kills++; this.combo++; this.comboT = 3.2; if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    if (e.elite) this.eliteKills++;
    this.vfx.die(x, y, D.col, !!D.boss || !!e.elite);
    if (this.vfx.fx.length < 240) { const r = this.vfx.sprite(e.texture.key, x, y, { s0: e.bs, s1: e.bs * 1.35, a0: 0.9, a1: 0, dur: 0.2, depth: 193, tint: 0xffffff }); if (r) { r.im.setTintFill(0xffffff).setFlipX(e.flipX).setRotation(e.rotation); } }
    sfx.kill();
    if (P.fangs) this.healAmt(P.fangs);
    // XP gems
    const xp = D.xp * (e.elite ? 4 : 1), n = D.boss ? 16 : e.elite ? 5 : 1;
    for (let i = 0; i < n; i++) this.dropGem(x + (n > 1 ? (rnd() - 0.5) * 36 : 0), y + (n > 1 ? (rnd() - 0.5) * 36 : 0), xp / n * (D.boss ? 1 : 1));
    if (!D.boss && rnd() < 0.012 + (e.elite ? 0.3 : 0)) this.dropPickup(x, y, 'heart');
    if (e.elite) this.dropPickup(x + 8, y, 'chest');
    this.seedsEarned += D.boss ? 40 : e.elite ? 4 : D.id === 'cat' ? 1.2 : 0.35;
    if (D.split) for (let i = 0; i < 2; i++) { const m = this.spawnEnemy('miniSlime', x + (i ? 7 : -7), y, { hp: 0.7 }); if (m) { m.age = 0.1; m.kx = (i ? 60 : -60); } }
    if (e.elite === 'volatile') this.enemyBlast(x, y, 34, e.dmg * 1.1, 0xff7a3a);
    if (D.ai === 'bomb' && e.st !== 'boom' && !o.quiet) this.vfx.boom(x, y, 20, 0xff8a3a, { shake: 0.1 });
    if (D.ai === 'skunk') this.addZone('gas', x, y, 18, 3.5);
    if (D.boss) this.onBossDeath(e);
    if (e.elite) { this.vfx.shake(0.3); this.toast({ text: `${AFFIX[e.elite].name} ${D.name} down!`, color: '#ffb82e', small: 1 }); }
  },
  enemyBlast(x, y, R, dmg, col) {
    this.vfx.boom(x, y, R, col, { shake: 0.2 }); sfx.boom();
    if (Math.hypot(this.px - x, this.py - y) < R + 5) this.hurtPlayer(dmg, null, { kx: this.px - x, ky: this.py - y });
  },
  onBossDeath(e) {
    this.bossKills++; this.bossDead = true; this.bossKilled[e.kind] = 1;
    this.vfx.shake(1); this.vfx.flashScreen(255, 240, 180, 350); this.hitStopFor(0.2);
    for (let i = 0; i < 4; i++) this.later(i * 0.12, () => { this.vfx.boom(e.x + (rnd() - 0.5) * 60, e.y + (rnd() - 0.5) * 50, 50 + rnd() * 30, 0xffd24a, { shake: 0.3 }); });
    this.vfx.ring(e.x, e.y, 150, 0xffffff, 0.9);
    this.dropPickup(e.x, e.y, 'heart'); this.dropPickup(e.x + 16, e.y, 'chest'); sfx.chest();
    this.toast({ text: `${e.d.name} defeated!`, color: '#ffd23f' });
    if (this.bosses.filter((b) => !b.dead).length === 0) emit('boss', null);
    for (const o of this.en) if (!o.dead && !o.d.boss && o.age > 0.3) { o.hp = 0; }
    if (e.kind === 'titan') this.later(3, () => this.finish(true));
  },

  // ------------------------------------------------------------ main enemy update
  updateEnemies(dt) {
    const en = this.en, px = this.px, py = this.py, t = this.t, world = this.world, c = C;
    const grid = this.grid;
    const frame = this.frameN;
    for (let i = 0; i < en.length; i++) {
      const e = en[i]; if (e.dead) continue;
      const D = e.d; e.age += dt; if (e.bt > 0) e.bt -= dt;
      c.dx = px - e.x; c.dy = py - e.y; c.l = Math.hypot(c.dx, c.dy) || 1; c.nx = c.dx / c.l; c.ny = c.dy / c.l;
      // status effects
      let sm = 1;
      if (e.slow > 0) { e.slow -= dt; sm *= e.slowF; if (e.slow <= 0) e.slowF = 1; }
      if (e.stun > 0) { e.stun -= dt; sm = 0; }
      if (e.burn > 0) { e.burn -= dt; e.burnT -= dt; if (e.burnT <= 0) { e.burnT = 0.3; this.hurt(e, e.burnD * 0.3 * 0.8, 0, 0, { dot: 1, col: 0xff8a2a }); } if (rnd() < dt * 8) this.vfx.fire(e.x, e.y - e.rad * 0.5, 0, 0, 1); if (e.burn <= 0) e.burnD = 0; }
      if (e.dead) continue;
      // behaviour
      c.vx = c.nx * e.spd; c.vy = c.ny * e.spd;
      const ai = D.ai; if (ai) AI[ai](this, e, dt, c);
      if (e.dead) continue;
      if (this.freezeT > 0) sm = 0;
      const ox = e.x, oy = e.y;
      e.x += (c.vx * sm + e.kx) * dt; e.y += (c.vy * sm + e.ky) * dt;
      const kd = Math.pow(0.86, dt * 60); e.kx *= kd; e.ky *= kd;
      if (!D.fly && !e.inv) {
        if (world.deep(e.x, oy + 3)) e.x = ox; if (world.deep(e.x, e.y + 3)) e.y = oy;
        const o = world.resolve(e.x, e.y + 3, e.rad * 0.8); e.x = o[0]; e.y = o[1] - 3;
      }
      if (e.x < 6) e.x = 6; else if (e.x > WW - 6) e.x = WW - 6; if (e.y < 6) e.y = 6; else if (e.y > WH - 6) e.y = WH - 6;
      // tether back near the player if left far behind
      if (!D.boss && !e.elite && c.l > 470 && e.age > 3) { const p = this.spawnPos(D.fly ? 0 : D.r, 270, 310); if (p) { e.x = p[0]; e.y = p[1]; e.age = 0.1; } }
      // separation (every other frame, light)
      if (((i + frame) & 1) === 0 && !D.boss && !e.inv && e.st !== 'under') {
        const n = grid.query(e.x, e.y, e.rad * 1.6), o = grid.out; let sx = 0, sy = 0;
        for (let k = 0; k < n && k < 14; k++) { const q = en[o[k]]; if (!q || q === e || q.dead || q.inv) continue; const ddx = e.x - q.x, ddy = e.y - q.y, rr = (e.rad + q.rad) * 0.75, d2 = ddx * ddx + ddy * ddy; if (d2 < rr * rr && d2 > 0.01) { const d = Math.sqrt(d2), f = (rr - d) / rr; sx += ddx / d * f; sy += ddy / d * f; } }
        if (sx || sy) { e.x += sx * 38 * dt * 2; e.y += sy * 38 * dt * 2; }
      }
      // touch
      if (!e.noTouch && !e.inv) { const rr = e.rad + 5; const ddx = px - e.x, ddy = py - e.y; if (ddx * ddx + ddy * ddy < rr * rr) { if (this.hurtPlayer(e.dmg, e, { kx: ddx, ky: ddy }) && e.d.boss !== 1) { /* contact */ } } }
      this.drawEnemy(e, dt, c);
    }
  },
  drawEnemy(e, dt, c) {
    const D = e.d;
    // facing
    const fx = Math.abs(c.vx) > 3 ? c.vx : c.dx;
    if (Math.abs(fx) > 2) e.face = fx < 0 ? -1 : 1;
    e.setFlipX(D.id === 'hedgeball' ? false : e.face < 0);
    e.setDepth(100 + (e.y + e.rad) * 0.05);
    e.sq *= Math.exp(-dt * 13);
    let sx = 1, sy = 1;
    if (e.age < 0.28) { const u = e.age / 0.28, p = 0.3 + 0.7 * popE(u); sx = sy = p; e.setAlpha(0.2 + 0.8 * u); } else if (!e.popDone) { e.popDone = 1; e.setAlpha(1); }
    if (e.sq > 0.004) { sx *= 1 + e.sq * 0.6; sy *= 1 - e.sq * 0.6; }
    if (e.hop) { sx *= 1 - 0.1 * e.hop; sy *= 1 + 0.2 * e.hop; }
    if (e.sxm) { sx *= e.sxm; sy *= e.sym; }
    e.setScale(e.bs * sx, e.bs * sy);
    // tint state: flash > frozen > none
    if (e.flash > 0) { e.flash -= dt; if (e.tstate !== 1) { e.setTintFill(0xffffff); e.tstate = 1; } }
    else if (e.stun > 0) { if (e.tstate !== 2) { e.clearTint(); e.setTint(0x8fdcff); e.tstate = 2; } }
    else if (e.fuseOn) { const on = Math.floor(this.t * 14) % 2; if (e.tstate !== 3 + on) { if (on) e.setTintFill(0xff4a3a); else e.clearTint(); e.tstate = 3 + on; } }
    else if (e.slow > 0 && D.boss !== 1) { if (e.tstate !== 5) { e.clearTint(); e.setTint(0xc0e8ff); e.tstate = 5; } }
    else if (e.tstate) { e.clearTint(); e.tstate = 0; }
    if (e.anims.isPlaying) e.anims.timeScale = e.stun > 0 ? 0 : e.slow > 0 ? 0.55 : 1;
    if (e.aura) e.aura.setPosition(e.x, e.y).setScale(e.rad * 3.2 / 64 * (1 + Math.sin(this.t * 5 + e.ph) * 0.06)).setAlpha(0.5 + Math.sin(this.t * 4 + e.ph) * 0.15);
  },
  drawBars() {
    const g = this.barG; g.clear();
    for (const e of this.en) {
      if (e.dead || !e.elite) continue;
      const w = 22, x = e.x - w / 2, y = e.y - e.rad - 9;
      g.fillStyle(0x000000, 0.7).fillRect(x - 1, y - 1, w + 2, 4);
      g.fillStyle(AFFIX[e.elite].tint, 1).fillRect(x, y, Math.max(0, w * e.hp / e.mhp), 2);
    }
  },

  // ------------------------------------------------------------ enemy projectiles / lobs
  eshot(x, y, a, sp, dmg, tex = 'pj_orb', o = {}) {
    if (this.ep.length > 160) return null;
    const im = this.vfx.imgs.get(tex).setPosition(x, y).setDepth(190).setScale(SC * (o.sc || 1)).setRotation(o.noRot ? 0 : a);
    if (o.add) im.setBlendMode(1);
    const p = { kind: 'line', im, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: o.life || 4.5, dmg, r: o.r || 4.5, col: o.col || 0xff7a4a, spin: o.spin || 0, noRot: o.noRot };
    this.ep.push(p); return p;
  },
  elob(x0, y0, tx, ty, T, h, tex, land, o = {}) {
    if (this.ep.length > 170) return null;
    const im = this.vfx.imgs.get(tex).setPosition(x0, y0).setDepth(190).setScale(SC * (o.sc || 1));
    const p = { kind: 'lob', im, sx: x0, sy: y0, tx, ty, T, h, t: 0, land, x: x0, y: y0, life: 9, spin: o.spin ?? 8 };
    this.ep.push(p); return p;
  },
  updateEnemyShots(dt) {
    const ep = this.ep, px = this.px, py = this.py;
    for (let i = ep.length - 1; i >= 0; i--) {
      const p = ep[i]; p.life -= dt; let dead = false;
      if (p.kind === 'lob') {
        p.t += dt; const u = Math.min(1, p.t / p.T); p.x = p.sx + (p.tx - p.sx) * u; p.y = p.sy + (p.ty - p.sy) * u - Math.sin(u * Math.PI) * p.h; p.im.rotation += p.spin * dt;
        if (u >= 1) { dead = true; if (p.land) p.land(this, p); }
      } else {
        p.x += p.vx * dt; p.y += p.vy * dt; if (p.spin) p.im.rotation += p.spin * dt;
        if (rnd() < dt * 14) this.vfx.trail(p.x, p.y, p.col, 1);
        const dx = p.x - px, dy = p.y - py, rr = p.r + 5;
        if (dx * dx + dy * dy < rr * rr && this.hurtPlayer(p.dmg, null, { kx: -p.vx, ky: -p.vy })) { dead = true; this.vfx.hit(p.x, p.y, p.col, 5); }
      }
      p.im.setPosition(p.x, p.y);
      if (dead || p.life <= 0 || p.x < -20 || p.y < -20 || p.x > WW + 20 || p.y > WH + 20) { this.vfx.imgs.put(p.im); ep[i] = ep[ep.length - 1]; ep.pop(); }
    }
  },
  clearEnemyShots(x, y, R) {
    const ep = this.ep;
    for (let i = ep.length - 1; i >= 0; i--) { const p = ep[i]; if (p.kind === 'lob') continue; if ((p.x - x) ** 2 + (p.y - y) ** 2 < R * R) { this.vfx.hit(p.x, p.y, p.col, 2); this.vfx.imgs.put(p.im); ep[i] = ep[ep.length - 1]; ep.pop(); } }
  },

  // ------------------------------------------------------------ hazard zones
  addZone(type, x, y, r, life) {
    if (this.zones.length > 46) { const z = this.zones.shift(); this.vfx.imgs.put(z.im); }
    const COL = { fire: 0xff6a22, cheese: 0xffd23f, honey: 0xffb020, gas: 0x6ad87a, wave: 0xffa060 };
    const im = this.vfx.imgs.get(type === 'wave' ? 'fx_ring' : 'fx_disc').setPosition(x, y).setDepth(type === 'wave' ? 6 : 4).setTint(COL[type]);
    if (type === 'fire') im.setBlendMode(1);
    const z = { type, x, y, r, life, max: life, t: 0, im, tick: 0, hitP: false };
    this.zones.push(z); return z;
  },
  updateZones(dt) {
    const Z = this.zones, px = this.px, py = this.py;
    for (let i = Z.length - 1; i >= 0; i--) {
      const z = Z[i]; z.life -= dt; z.t += dt; z.tick -= dt;
      const u = z.t / z.max, im = z.im;
      if (z.type === 'wave') {
        z.r += z.sp * dt; im.setScale(z.r * 2 / 58).setAlpha(Math.max(0, 1 - u) * 0.9); im.setTint(0xffb070);
        const d = Math.hypot(px - z.x, py - z.y);
        if (!z.hitP && Math.abs(d - z.r) < 6) { if (this.hurtPlayer(z.dmg, null, { kx: px - z.x, ky: py - z.y })) z.hitP = true; }
        if (rnd() < dt * 40) { const a = rnd() * TAU; this.vfx.puff(z.x + Math.cos(a) * z.r, z.y + Math.sin(a) * z.r, 1, 0x9a7a5a); }
      } else {
        const fade = Math.min(1, z.t / 0.25, z.life / 0.5);
        im.setScale(z.r * 2 / 64).setAlpha(fade * (z.type === 'fire' ? 0.55 + Math.sin(this.t * 14 + i) * 0.15 : z.type === 'gas' ? 0.5 : 0.7));
        if (z.type === 'fire') {
          if (rnd() < dt * 10) this.vfx.fire(z.x + (rnd() - 0.5) * z.r, z.y + (rnd() - 0.5) * z.r * 0.7, 0, 0, 1);
          if (z.tick <= 0) { z.tick = 0.3; for (const e of this.near(z.x, z.y, z.r, this._qb)) { this.hurt(e, 1.3 * this.P.dmg, 0, 0, { dot: 1, col: 0xff7a2a }); this.ignite(e, 4 * this.P.dmg); } }
        } else if (z.type === 'cheese' || z.type === 'honey') {
          if (z.tick <= 0) { z.tick = 0.25; for (const e of this.near(z.x, z.y, z.r, this._qb)) { e.slow = Math.max(e.slow, 0.5); e.slowF = Math.min(e.slowF, 0.45); if (z.type === 'cheese') this.hurt(e, 0.6 * this.P.dmg, 0, 0, { dot: 1, col: 0xffd23f }); } }
        } else if (z.type === 'gas') {
          if (rnd() < dt * 7) { this.vfx._tint = 0x7ae88a; this.vfx.puff(z.x + (rnd() - 0.5) * z.r * 1.4, z.y + (rnd() - 0.5) * z.r, 1, 0x7ae88a); }
          if (z.tick <= 0 && (px - z.x) ** 2 + (py - z.y) ** 2 < (z.r + 4) ** 2) { z.tick = 0.35; this.hurtPlayer(z.dmg || 4, null, { gas: 1 }); this.pslow = 0.5; }
        }
      }
      if (z.life <= 0) { this.vfx.imgs.put(im); Z[i] = Z[Z.length - 1]; Z.pop(); }
    }
  },

  // ------------------------------------------------------------ director
  director(dt) {
    const t = this.t;
    if (this.bossAlive()) { this.spawnAcc += dt * 0.5 * (1.5 + t * 0.026); } else this.spawnAcc += dt * (1.5 + t * 0.026);
    const cap = Math.min(MAX_EN, 70 + t * 0.55);
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1; if (this.en.length >= cap) { this.spawnAcc = 0; break; }
      let tot = 0; const ws = this.dirW; ws.length = 0;
      for (const k in ENEMIES) { const D = ENEMIES[k]; if (D.w <= 0 || t < D.from) { ws.push(0); continue; } const age = t - D.from; let w = D.w; if (D.xp <= 1) w *= Math.max(0.22, 1 - t / 260); else if (age < 25) w *= 0.4 + age / 25 * 0.6; ws.push(w); tot += w; }
      let r = rnd() * tot, kind = 'beetle', idx = 0;
      for (const k in ENEMIES) { const w = ws[idx++]; if (r < w) { kind = k; break; } r -= w; }
      const D = ENEMIES[kind], grp = kind === 'rat' ? 3 + ((rnd() * 3) | 0) : kind === 'bee' ? 2 : 1;
      const pos = this.spawnPos(D.fly ? 0 : D.r); if (!pos) continue;
      for (let g = 0; g < grp; g++) this.spawnEnemy(kind, pos[0] + (rnd() - 0.5) * 22, pos[1] + (rnd() - 0.5) * 22);
    }
    // elites
    if (t >= this.nextElite && !this.bossAlive()) {
      this.nextElite = t + Math.max(13, 30 - t * 0.05);
      const pool = ['beetle', 'ant', 'rat', 'bee', 'slime', 'snake', 'bat', 'hedgehog', 'mole', 'spitter', 'skunk', 'crow', 'cat', 'boar', 'bombbug'].filter((k) => ENEMIES[k].from <= t + 20 && ENEMIES[k].from > t - 90 || ENEMIES[k].from <= 40);
      const kind = pool[(rnd() * pool.length) | 0], aff = Object.keys(AFFIX)[(rnd() * 4) | 0], D = ENEMIES[kind], pos = this.spawnPos(D.fly ? 0 : D.r, 230, 280);
      if (pos) { const e = this.spawnEnemy(kind, pos[0], pos[1], { elite: aff }); if (e) this.toast({ text: `${AFFIX[aff].name} ${D.name}!`, color: '#' + AFFIX[aff].tint.toString(16).padStart(6, '0'), small: 1 }); }
    }
    // swarms
    for (const [at, kind, n] of SWARMS) if (t >= at && !this.swarms.has(at)) { this.swarms.add(at); this.spawnRing(kind, n); this.toast({ text: 'SWARM!', sub: `${ENEMIES[kind].name}s are closing in`, color: '#ff7a5a' }); this.vfx.shake(0.15); }
    // bosses
    for (const [at, kind] of BOSS_SCHEDULE) if (t >= at && !this.swarms.has('b' + at)) {
      this.swarms.add('b' + at);
      const D = ENEMIES[kind], bp = this.spawnPos(0, 230, 270) || [this.px + 120, this.py];
      const e = this.spawnEnemy(kind, bp[0], bp[1], { hp: 1 + (t - at) * 0 });
      if (e) { e.mhp = e.hp = D.hp * (1 + t / 400); e.intro = 1.6; this.vfx.shake(0.5); this.vfx.flashScreen(255, 80, 60, 200); this.toast({ text: D.name.toUpperCase(), sub: 'A boss approaches!', color: '#ff5a5a', big: 1 }); sfx.boom(); emit('boss', 1); }
    }
  },
  bossAlive() { return this.bosses.some((b) => !b.dead); },
};

// ================================================================== AI behaviours
const dirTo = (e, x, y) => Math.atan2(y - e.y, x - e.x);
const AI = {
  pack(g, e, dt, c) { const w = Math.sin(g.t * 3 + e.ph) * 0.55; const f = c.l > 130 ? 1.2 : 1; c.vx = (c.nx - c.ny * w) * e.spd * f; c.vy = (c.ny + c.nx * w) * e.spd * f; },
  zig(g, e, dt, c) { const w = Math.sin(g.t * 7 + e.ph) * 1.15; c.vx = (c.nx - c.ny * w) * e.spd; c.vy = (c.ny + c.nx * w) * e.spd; },
  bat(g, e, dt, c) { const w = Math.sin(g.t * 6 + e.ph) * 0.9; c.vx = (c.nx - c.ny * w) * e.spd; c.vy = (c.ny + c.nx * w) * e.spd; },
  hop(g, e, dt, c) {
    const u = (g.t * 2.4 + e.ph) % 1, h = u < 0.4 ? Math.sin(u / 0.4 * Math.PI) : 0; e.hop = h;
    const s = 0.05 + h * 2.4; c.vx = c.nx * e.spd * s; c.vy = c.ny * e.spd * s;
    if (h > 0.9 && !e.landed) { e.landed = 1; } if (u > 0.45) e.landed = 0;
    if (u > 0.4 && e.hopP !== 1 && u < 0.46) { e.hopP = 1; g.vfx.puff(e.x, e.y + e.rad * 0.6, 1, 0xa8f0b8); } else if (u < 0.3) e.hopP = 0;
  },
  hedge(g, e, dt, c) {
    e.stt -= dt;
    if (e.st === 'curl') {
      c.vx = e.cx * e.spd * 3.3; c.vy = e.cy * e.spd * 3.3; e.rotation += 14 * dt * (e.cx < 0 ? -1 : 1);
      const k = Math.min(1, dt * 1.5), na = Math.atan2(c.ny, c.nx), ca = Math.atan2(e.cy, e.cx); let d = na - ca; d = Math.atan2(Math.sin(d), Math.cos(d)); const nca = ca + d * k; e.cx = Math.cos(nca); e.cy = Math.sin(nca);
      if (rnd() < dt * 12) g.vfx.puff(e.x, e.y + e.rad * 0.5, 1, 0xcbb69a);
      if (e.stt <= 0) { e.st = ''; e.stt = 2.2 + rnd(); e.rotation = 0; e.armor = 0; e.play({ key: 'hedgehog_walk', startFrame: 0 }); e.setTexture('hedgehog_w0'); e.d = ENEMIES.hedgehog; }
    } else if (c.l < 80 && e.stt <= 0) {
      e.st = 'curl'; e.stt = 2.4; e.cx = c.nx; e.cy = c.ny; e.armor = 0.55; e.anims.stop(); e.setTexture('hedgeball'); g.vfx.hit(e.x, e.y, 0xd8c0a0, 5); g.vfx.ring(e.x, e.y, 14, 0xffffff, 0.25, 0.5);
    }
  },
  mole(g, e, dt, c) {
    e.stt -= dt;
    if (e.st === '') { c.vx *= 0.8; c.vy *= 0.8; if (c.l < 120 && e.stt <= 0) { e.st = 'dig'; e.stt = 0.55; e.anims.stop(); } }
    else if (e.st === 'dig') { c.vx = c.vy = 0; const u = 1 - e.stt / 0.55; e.sxm = 1 + u * 0.3; e.sym = 1 - u * 0.8; e.setAlpha(1 - u * 0.7); e.keepAlpha = 1; if (rnd() < dt * 30) g.vfx.puff(e.x + (rnd() - 0.5) * 10, e.y + 6, 1, 0x8a6a4a);
      if (e.stt <= 0) { e.st = 'under'; e.stt = 1.0; e.inv = true; e.tx = g.px + g.vx * 0.35; e.ty = g.py + g.vy * 0.35; g.teleDisc(e.tx, e.ty, 20, 1.0, 0xc08a50); e.setAlpha(0); } }
    else if (e.st === 'under') {
      const dx = e.tx - e.x, dy = e.ty - e.y, l = Math.hypot(dx, dy) || 1; const sp = Math.min(140, l / Math.max(0.05, e.stt)); c.vx = dx / l * sp; c.vy = dy / l * sp;
      if (rnd() < dt * 28) { g.vfx._tint = 0x6a4a30; g.vfx.chunk.explode(1, e.x, e.y + 5); g.vfx.puff(e.x, e.y + 5, 1, 0x7a5a3a); }
      if (e.stt <= 0 || l < 5) { e.st = 'rest'; e.stt = 1.1; e.inv = false; e.sxm = e.sym = undefined; e.keepAlpha = 0; e.setAlpha(1); e.anims.play({ key: 'mole_walk', startFrame: 0 }); e.stun = 0.9;
        g.vfx.die(e.x, e.y + 4, 0x8a6a4a, false); g.vfx.ring(e.x, e.y, 24, 0xc08a50, 0.35); g.vfx.shake(0.12);
        if (Math.hypot(g.px - e.x, g.py - e.y) < 24) g.hurtPlayer(e.dmg, e, { kx: g.px - e.x, ky: g.py - e.y }); }
    } else if (e.st === 'rest') { if (e.stt <= 0) { e.st = ''; e.stt = 3 + rnd() * 1.5; } }
    if (e.st === 'under' || e.st === 'dig') e.noTouch = true; else e.noTouch = false;
  },
  spit(g, e, dt, c) {
    let s = 1; if (c.l < 85) s = -0.7; else if (c.l < 115) s = 0; c.vx = c.nx * e.spd * s; c.vy = c.ny * e.spd * s;
    e.stt -= dt; if (e.stt <= 0 && c.l < 200) { e.stt = 2.3 + rnd(); g.eshot(e.x, e.y, dirTo(e, g.px, g.py), 74, e.dmg, 'pj_orb'); sfx.beep?.(300, 0.05, 'square', 0.015, 100, 'spit', 0.1); g.vfx.hit(e.x, e.y, 0xff7a4a, 2); e.sq = 0.25; }
  },
  skunk(g, e, dt, c) {
    let s = 1; if (c.l < 55) s = -1; else if (c.l < 90) s = 0.1; c.vx = c.nx * e.spd * s; c.vy = c.ny * e.spd * s;
    e.stt -= dt; if (e.stt <= 0 && c.l < 210) { e.stt = 3.4 + rnd(); e.sq = 0.3; const tx = g.px + g.vx * 0.3, ty = g.py + g.vy * 0.3; g.elob(e.x, e.y, tx, ty, 0.85, 30, 'pj_gas', (gg) => { gg.addZone('gas', tx, ty, 21, 4.5); gg.vfx.puff(tx, ty, 4, 0x7ae88a); }, { sc: 0.7, spin: 0 }); }
  },
  crow(g, e, dt, c) {
    e.stt -= dt;
    if (e.st === '') { e.ca = (e.ca ?? e.ph) + dt * 1.8 * (e.ph > 3 ? 1 : -1); const tx = g.px + Math.cos(e.ca) * 85, ty = g.py + Math.sin(e.ca) * 70, dx = tx - e.x, dy = ty - e.y, l = Math.hypot(dx, dy) || 1; c.vx = dx / l * e.spd * 1.7; c.vy = dy / l * e.spd * 1.7; if (e.stt <= 0 && c.l < 150) { e.st = 'aim'; e.stt = 0.5; e.dx = c.nx; e.dy = c.ny; } else if (e.stt <= 0) e.stt = 0.5; }
    else if (e.st === 'aim') { c.vx = c.vy = 0; e.fuseOn = 1; e.dx = c.nx; e.dy = c.ny; e.sxm = 1.15; e.sym = 0.9; if (e.stt <= 0) { e.st = 'dive'; e.stt = 0.7; e.fuseOn = 0; e.sxm = e.sym = undefined; g.vfx.ring(e.x, e.y, 14, 0xffffff, 0.2, 0.5); } }
    else if (e.st === 'dive') { c.vx = e.dx * 215; c.vy = e.dy * 215; if (rnd() < 0.8) g.vfx.trail(e.x, e.y, 0xaaaadd, 1); if (e.stt <= 0) { e.st = ''; e.stt = 2 + rnd() * 1.5; } }
  },
  cat(g, e, dt, c) {
    e.stt -= dt;
    if (e.st === '') { if (c.l < 85 && e.stt <= 0) { e.st = 'crouch'; e.stt = 0.35; e.dx = c.nx; e.dy = c.ny; } }
    else if (e.st === 'crouch') { c.vx = c.vy = 0; e.sxm = 1.2; e.sym = 0.8; e.dx = c.nx; e.dy = c.ny; e.fuseOn = 1; if (e.stt <= 0) { e.st = 'leap'; e.stt = 0.32; e.fuseOn = 0; e.sxm = 0.85; e.sym = 1.15; g.vfx.puff(e.x, e.y + 6, 2); } }
    else if (e.st === 'leap') { c.vx = e.dx * 200; c.vy = e.dy * 200; if (rnd() < 0.8) g.vfx.trail(e.x, e.y, 0xffffff, 1); if (e.stt <= 0) { e.st = 'rest'; e.stt = 0.6; e.sxm = e.sym = undefined; } }
    else if (e.st === 'rest') { c.vx *= 0.3; c.vy *= 0.3; if (e.stt <= 0) { e.st = ''; e.stt = 2.4 + rnd(); } }
  },
  boar(g, e, dt, c) {
    e.stt -= dt; e.ct = (e.ct ?? e.ph) + dt; const k = e.ct % 3.4;
    if (k > 2.5) { c.vx *= 3.4; c.vy *= 3.4; e.fuseOn = 0; if (rnd() < dt * 20) g.vfx.puff(e.x - c.nx * 8, e.y + 8, 1); }
    else if (k > 2.0) { c.vx *= 0.1; c.vy *= 0.1; e.fuseOn = 1; if (rnd() < dt * 14) g.vfx.puff(e.x, e.y + 9, 1); } else e.fuseOn = 0;
  },
  bomb(g, e, dt, c) {
    if (e.st === 'fuse') {
      e.stt -= dt; c.vx = c.vy = 0; e.fuseOn = 1; const u = 1 - e.stt / 0.7; e.sxm = e.sym = 1 + u * 0.28 + Math.sin(g.t * 40) * 0.04;
      if (rnd() < dt * 30) g.vfx.sprite('fx_dot', e.x + (rnd() - 0.5) * 4, e.y - e.rad, { s0: 1.4, s1: 0, a0: 1, a1: 0, dur: 0.25, tint: 0xffd24a, vy: -30 });
      if (e.stt <= 0) { e.st = 'boom'; g.enemyBlast(e.x, e.y, 32, e.dmg, 0xff8a3a); g.kill(e, { quiet: true }); }
    } else if (c.l < 36) { e.st = 'fuse'; e.stt = 0.7; sfx.beep?.(900, 0.08, 'square', 0.02, 0, 'fuse', 0.2); }
  },
};
AI.hornet = function (g, e, dt, c) {
  const hp = e.hp / e.mhp, ph = hp < 0.3 ? 3 : hp < 0.6 ? 2 : 1;
  if (ph > e.phase) { e.phase = ph; if (ph === 3) { e.spd *= 1.25; this_enrage(g, e); } }
  if (e.intro > 0) { e.intro -= dt; c.vx = c.vy = 0; e.inv = true; e.noTouch = true; if (e.intro <= 0) { e.inv = false; e.noTouch = false; } return; }
  e.stt -= dt;
  if (e.st === '') {
    e.ca = (e.ca ?? 0) + dt * 0.5 * (ph === 3 ? 1.4 : 1); const tx = g.px + Math.cos(e.ca) * 100, ty = g.py + Math.sin(e.ca) * 80, dx = tx - e.x, dy = ty - e.y, l = Math.hypot(dx, dy) || 1;
    c.vx = dx / l * Math.min(120, l * 2.5); c.vy = dy / l * Math.min(120, l * 2.5);
    if (e.stt <= 0) { const r = rnd(); e.st = r < 0.4 ? 'fan' : r < 0.7 ? 'summon' : 'dash'; e.stt = e.st === 'dash' ? 0.8 : 0.55; e.fuseOn = 1; if (e.st === 'dash') { e.tx = g.px; e.ty = g.py; g.teleLine(e.x, e.y, e.x + c.nx * 260, e.y + c.ny * 260, 14, 0.8); } }
  } else if (e.st === 'fan') {
    c.vx = c.vy = 0; e.sxm = 1.1; e.sym = 0.92;
    if (e.stt <= 0) { e.fuseOn = 0; e.sxm = e.sym = undefined; const n = ph === 1 ? 7 : 11, base = dirTo(e, g.px, g.py); for (let i = 0; i < n; i++) g.eshot(e.x, e.y, base + (i - (n - 1) / 2) * 0.17, 100, 9, 'pj_sting'); sfx.nova(); g.vfx.ring(e.x, e.y, 28, 0xffe14a, 0.3);
      if (ph === 3) g.later(0.45, () => { if (e.dead) return; const b2 = dirTo(e, g.px, g.py); for (let i = 0; i < 9; i++) g.eshot(e.x, e.y, b2 + (i - 4) * 0.2, 110, 9, 'pj_sting'); });
      e.st = ''; e.stt = ph === 3 ? 1.2 : 1.9; }
  } else if (e.st === 'summon') {
    c.vx = c.vy = 0; if (e.stt <= 0) { e.fuseOn = 0; const n = ph === 1 ? 3 : 5; for (let i = 0; i < n; i++) { const a = i / n * TAU; g.spawnEnemy('bee', e.x + Math.cos(a) * 26, e.y + Math.sin(a) * 26); } g.vfx.ring(e.x, e.y, 36, 0xffe14a, 0.4); g.vfx.boom(e.x, e.y, 22, 0xffe14a, { shake: 0.1 }); e.st = ''; e.stt = 2.0; }
  } else if (e.st === 'dash') {
    if (e.stt > 0 && !e.dashing) { c.vx = c.vy = 0; e.sxm = 0.9; e.sym = 1.1; e.dx = c.nx; e.dy = c.ny; e.fuseOn = 1; if (e.stt <= 0.01) e.dashing = 1; }
    if (e.stt <= 0 && !e.dashing) { e.dashing = 1; e.stt = 0.5; e.fuseOn = 0; e.sxm = e.sym = undefined; }
    if (e.dashing) { c.vx = e.dx * 280; c.vy = e.dy * 280; if (rnd() < 0.9) g.vfx.trail(e.x, e.y, 0xffe14a, 1); if (e.stt <= 0) { e.dashing = 0; e.st = ''; e.stt = 1.5; } }
  }
};
function this_enrage(g, e) { g.toast({ text: 'The Queen is ENRAGED!', color: '#ff5a5a', small: 1 }); g.vfx.shake(0.5); g.vfx.ring(e.x, e.y, 80, 0xff5a5a, 0.6); }
AI.king = function (g, e, dt, c) {
  const hp = e.hp / e.mhp, ph = hp < 0.5 ? 2 : 1;
  if (ph > e.phase) { e.phase = ph; e.spd *= 1.3; e.play('boss2_walk', true); g.toast({ text: 'The Cat King is ENRAGED!', color: '#ff5a5a', small: 1 }); g.vfx.shake(0.6); g.vfx.ring(e.x, e.y, 90, 0xff5a5a, 0.6); g.spawnRing('ant', 12, 190); sfx.boom(); }
  if (e.intro > 0) { e.intro -= dt; c.vx = c.vy = 0; e.inv = true; e.noTouch = true; if (e.intro <= 0) { e.inv = false; e.noTouch = false; } return; }
  e.stt -= dt;
  if (e.st === '') {
    if (e.stt <= 0) {
      if (rnd() < (ph === 2 ? 0.55 : 0.4)) { e.st = 'slamT'; e.stt = 0.9; e.tx = g.px + g.vx * 0.2; e.ty = g.py + g.vy * 0.2; g.teleDisc(e.tx, e.ty, 36, 0.9); e.fuseOn = 1; }
      else { const n = ph === 2 ? 16 : 10, off = rnd() * TAU; for (let i = 0; i < n; i++) g.eshot(e.x, e.y, off + i / n * TAU, ph === 2 ? 82 : 64, 10, 'pj_orb'); sfx.nova(); g.vfx.ring(e.x, e.y, 34, 0xff7a4a, 0.35); e.stt = ph === 2 ? 2.2 : 3.2; }
    }
  } else if (e.st === 'slamT') {
    c.vx = c.vy = 0; e.sxm = 1.12; e.sym = 0.9; if (e.stt <= 0) { e.st = 'leap'; e.stt = 0.55; e.sx0 = e.x; e.sy0 = e.y; e.fuseOn = 0; e.noTouch = true; }
  } else if (e.st === 'leap') {
    const u = Math.min(1, 1 - e.stt / 0.55); c.vx = c.vy = 0; e.x = e.sx0 + (e.tx - e.sx0) * u; e.y = e.sy0 + (e.ty - e.sy0) * u; const s = 1 + Math.sin(u * Math.PI) * 0.35; e.sxm = e.sym = s; e.inv = u < 0.9 && u > 0.1;
    if (e.stt <= 0) { e.st = ''; e.stt = ph === 2 ? 1.3 : 2; e.sxm = e.sym = undefined; e.inv = false; e.noTouch = false; g.vfx.boom(e.x, e.y, 42, 0xc0a070, { shake: 0.55 }); const z = g.addZone('wave', e.x, e.y, 10, 0.7); z.sp = 140; z.dmg = 14; if (Math.hypot(g.px - e.x, g.py - e.y) < 36) g.hurtPlayer(22, e, { kx: g.px - e.x, ky: g.py - e.y }); sfx.boom(); }
  }
  if (e.st === '' ) { c.vx *= 0.9; c.vy *= 0.9; }
};
AI.titan = function (g, e, dt, c) {
  const hp = e.hp / e.mhp, ph = hp < 0.4 ? 2 : 1;
  if (ph > e.phase) { e.phase = ph; e.spd *= 1.3; g.toast({ text: 'The Titan is ENRAGED!', color: '#ff5a5a', small: 1 }); g.vfx.shake(0.7); g.vfx.ring(e.x, e.y, 100, 0xff5a5a, 0.6); }
  if (e.intro > 0) { e.intro -= dt; c.vx = c.vy = 0; e.inv = true; e.noTouch = true; if (e.intro <= 0) { e.inv = false; e.noTouch = false; } return; }
  e.stt -= dt;
  const wave = (n) => { for (let i = 0; i < n; i++) g.later(i * 0.35, () => { if (e.dead) return; const z = g.addZone('wave', e.x, e.y + 6, 12, 1.2); z.sp = 125; z.dmg = 16; g.vfx.shake(0.25); sfx.boom(); }); };
  if (e.st === '') {
    if (e.stt <= 0) {
      const r = rnd(); e.stt = 0.8; e.fuseOn = 1;
      e.st = r < 0.3 ? 'quake' : r < 0.55 ? 'rocks' : r < 0.78 ? 'summon' : 'burrow';
      if (e.st === 'burrow') { e.stt = 0.7; e.tx = g.px; e.ty = g.py; g.teleDisc(e.tx, e.ty, 30, 1.7, 0xc08a50); }
    }
  } else if (e.st === 'quake') {
    c.vx = c.vy = 0; e.sxm = 1.05; e.sym = 0.94; if (rnd() < dt * 30) g.vfx.puff(e.x + (rnd() - 0.5) * 30, e.y + 14, 1, 0x8a6a4a);
    if (e.stt <= 0) { e.fuseOn = 0; e.sxm = e.sym = undefined; wave(ph === 2 ? 4 : 3); e.st = ''; e.stt = ph === 2 ? 1.6 : 2.6; }
  } else if (e.st === 'rocks') {
    c.vx = c.vy = 0; if (e.stt <= 0) { e.fuseOn = 0; const n = ph === 2 ? 6 : 4; for (let i = 0; i < n; i++) { const a = rnd() * TAU, d = i === 0 ? 0 : 20 + rnd() * 50, tx = g.px + g.vx * 0.3 + Math.cos(a) * d, ty = g.py + g.vy * 0.3 + Math.sin(a) * d; g.later(i * 0.18, () => { g.teleDisc(tx, ty, 22, 0.8); g.elob(e.x, e.y - 10, tx, ty, 0.8, 70, 'pj_rock', (gg) => { gg.vfx.boom(tx, ty, 24, 0x9a8a7a, { shake: 0.2, chunk: 0x6a5a4a }); if (Math.hypot(gg.px - tx, gg.py - ty) < 24) gg.hurtPlayer(14, null, { kx: gg.px - tx, ky: gg.py - ty }); }, { sc: 1.1, spin: 6 }); }); } e.st = ''; e.stt = ph === 2 ? 1.8 : 2.8; }
  } else if (e.st === 'summon') {
    c.vx = c.vy = 0; if (e.stt <= 0) { e.fuseOn = 0; const n = ph === 2 ? 5 : 3; for (let i = 0; i < n; i++) { const a = i / n * TAU + rnd(), m = g.spawnEnemy('mole', e.x + Math.cos(a) * 40, e.y + Math.sin(a) * 40); if (m) { m.stt = 0.3; } } g.vfx.ring(e.x, e.y, 50, 0xc08a50, 0.5); e.st = ''; e.stt = ph === 2 ? 2 : 3.2; }
  } else if (e.st === 'burrow') {
    if (!e.under && e.stt <= 0) { e.under = 1; e.inv = true; e.noTouch = true; e.stt = 1.0; e.setAlpha(0); e.keepAlpha = 1; g.vfx.die(e.x, e.y + 8, 0x8a6a4a, true); }
    if (!e.under) { c.vx = c.vy = 0; e.sym = 1 - (1 - e.stt / 0.7) * 0.2; e.sxm = 1; }
    else {
      e.sxm = e.sym = undefined; const dx = e.tx - e.x, dy = e.ty - e.y, l = Math.hypot(dx, dy) || 1, sp = Math.min(220, l / Math.max(0.05, e.stt)); c.vx = dx / l * sp; c.vy = dy / l * sp; if (rnd() < dt * 40) g.vfx.puff(e.x, e.y + 8, 1, 0x7a5a3a);
      if (e.stt <= 0 || l < 6) { e.under = 0; e.inv = false; e.noTouch = false; e.keepAlpha = 0; e.setAlpha(1); e.fuseOn = 0; e.st = ''; e.stt = ph === 2 ? 1.2 : 2.2; g.vfx.boom(e.x, e.y, 46, 0xc0a070, { shake: 0.6 }); wave(ph === 2 ? 2 : 1); if (Math.hypot(g.px - e.x, g.py - e.y) < 30) g.hurtPlayer(24, e, { kx: g.px - e.x, ky: g.py - e.y }); }
    }
  }
  if (e.st === '') { const s = 1; c.vx *= s; c.vy *= s; }
};

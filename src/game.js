// Scenes: Menu (hero parade) + Game (the run). Physics-free: spatial-hash collisions, pooled sprites/particles.
import Phaser from 'phaser';
import { emit, on } from './bus.js';
import { sfx } from './sfx.js';
import { installTextures, SC } from './sprites.js';
import { getWorld, WW, WH, START } from './world.js';
import { DIR8 } from './hero.js';
import { RUN_SECONDS as RS, BOSS_SCHEDULE, WEAPONS, PASSIVES, PERKS } from './defs.js';
import { newState, recalc, buildOffer, applyCard } from './cards.js';
import { Vfx } from './vfx.js';
import { Grid } from './pool.js';
import { WeaponMethods } from './weapons.js';
import { EnemyMethods, MAX_EN, prepEnemyDefs } from './enemies.js';

export const W = WW, H = WH;
export const RUN_SECONDS = RS;
const TAU = Math.PI * 2;
const clamp = Phaser.Math.Clamp;
const needXp = (l) => Math.floor(5 + (l - 1) * 4 + Math.pow(l - 1, 1.5));
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const qs = new URLSearchParams(location.search);

export class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }
  create() {
    installTextures(this);
    const w = this.world = getWorld(); w.attach(this);
    this.cameras.main.setZoom(2);
    this.path = w.paths[0]; this.cum = [0];
    for (let i = 1; i < this.path.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(this.path[i][0] - this.path[i - 1][0], this.path[i][1] - this.path[i - 1][1]));
    this.s = this.cum[this.cum.length - 1] * 0.12; this.dir = 1; this.t = 0;
    const [x, y] = this.at(this.s);
    this.cx = x; this.cy = y - 38;
    w.ensureRect(x - 300, y - 220, x + 300, y + 200); w.populate(this, SC);
    this.h = this.add.sprite(x, y, 'hs_w0').setScale(SC * 1.45).play('hs_walk').setDepth(100 + y * 0.05);
    this.cameras.main.centerOn(this.cx, this.cy);
  }
  at(s) { let lo = 0, hi = this.cum.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (this.cum[m] < s) lo = m + 1; else hi = m; } return this.path[lo]; }
  update(_, d) {
    const dt = Math.min(d, 50) / 1000; this.t += dt;
    const len = this.cum[this.cum.length - 1], px = this.h.x;
    this.s += this.dir * 34 * dt; if (this.s > len * 0.9) this.dir = -1; else if (this.s < len * 0.06) this.dir = 1;
    const [x, y] = this.at(this.s);
    this.h.setFlipX(x < px - 0.001 ? true : x > px + 0.001 ? false : this.h.flipX);
    this.h.setPosition(x, y - Math.abs(Math.sin(this.t * 6.3)) * 1.2).setDepth(100 + y * 0.05);
    const k = 1 - Math.exp(-dt * 2.2); this.cx += (x - this.cx) * k; this.cy += (y - 38 - this.cy) * k;
    const cam = this.cameras.main; cam.centerOn(Math.round(this.cx * 2) / 2, Math.round(this.cy * 2) / 2);
    this.world.stream(cam, x, y); this.world.update(dt, this.t, x, y, cam);
  }
}

export class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }
  init(cfg) { this.cfg = cfg || { mods: {} }; }

  create() {
    installTextures(this); prepEnemyDefs(this);
    const cfg = this.cfg, m = cfg.mods || {};
    this.speedMul = Math.min(4, cfg.speed || 1);
    const cam = this.cameras.main; cam.setZoom(2);
    const world = this.world = getWorld(); world.attach(this);
    world.ensureRect(START.x - 300, START.y - 200, START.x + 300, START.y + 200);
    world.populate(this, SC);

    // ---- state
    Object.assign(this, newState());
    this.baseMods = m; this.t = 0; this.level = 1; this.xp = 0; this.kills = 0; this.queue = 0; this.choosing = false; this.finished = false;
    this.rerolls = m.rerolls || 0; this.choices = [];
    this.px = START.x; this.py = START.y; this.vx = 0; this.vy = 0; this.camX = this.px; this.camY = this.py;
    this.fdx = 1; this.fdy = 0; this.aim = 0; this.tgt = null; this.oct = 0; this.view = 's'; this.mirror = 0;
    this.iframes = 0; this.dashT = 0; this.dashI = 0; this.dashCdT = 0; this.dashReq = false; this.dashDx = 1; this.dashDy = 0; this.afterT = 0;
    this.sqP = 0; this.flashT = 0; this.kick = 0; this.stepT = 0; this.stillT = 0; this.hitStopT = 0; this.hudT = 0;
    this.dealt = 0; this.combo = 0; this.comboT = 0; this.maxCombo = 0; this.eliteKills = 0; this.bossKills = 0; this.bossDead = false; this.bossKilled = {}; this.seedsEarned = 0; this.gemsGot = 0;
    this.spawnAcc = 0; this.nextElite = 55; this.freezeT = 0; this.pslow = 1; this.frameN = 0;
    this.laterQ = []; this.epool = []; this.en = []; this.bosses = []; this.ep = []; this.zones = []; this.pj = [];
    this.swarms = new Set(); this.dirW = []; this.uidc = 0; this._qa = []; this._qb = []; this._qc = [];
    this.gems = []; this.pick = []; this.grid = new Grid(WW, WH, 32, MAX_EN + 80);
    this.P = {}; recalc(this); this.hp = this.P.maxHp;
    this.perf = { ms: 0, fps: 60, worst: 0, acc: 0, n: 0, win: 0, wn: 0, slow: 0 };

    // ---- fx
    const fxq = qs.get('fx'); this.quality = fxq === 'low' ? 0 : fxq === 'med' ? 1 : 2;
    this.vfx = new Vfx(this, this.quality);
    this.vfx.setPost(this.quality > 1 && qs.get('bloom') !== '0');
    this.barG = this.add.graphics().setDepth(196);
    this.shadow = this.add.image(this.px, this.py + 11, 'shadow').setDepth(3);
    this.ring = this.add.ellipse(this.px, this.py + 11, 22, 9).setDepth(3).setVisible(false);
    if (cfg.glow) { this.ring.setVisible(true).setStrokeStyle(1.5, cfg.glow, 0.9).setFillStyle(cfg.glow, 0.12); }

    // ---- hero
    this.pl = this.add.sprite(this.px, this.py, 'hs_i0').setScale(SC).setDepth(100);
    this.cur = 'hs_idle'; this.pl.play('hs_idle');
    this.cannon = this.add.image(this.px, this.py, 'cannon').setOrigin(0.27, 0.56).setScale(SC * 0.85).setDepth(101);
    this.bluckT = 0;

    // ---- start weapons
    this.addWeapon('seed', 1);
    if (m.blades) this.addWeapon('blades', Math.min(4, 1 + Math.floor(m.blades / 2)));

    // ---- input
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,SPACE,SHIFT');
    this.input.keyboard.on('keydown-G', () => this.togglePost());
    this.input.keyboard.on('keydown-F3', () => this.togglePerf());
    this.joy = { on: false, ox: 0, oy: 0, x: 0, y: 0 };
    this.joyG = this.add.graphics().setScrollFactor(0).setDepth(250);
    this.input.on('pointerdown', (ptr) => { if (!ptr.wasTouch && this.input.keyboard.enabled && !cfg.touchOnly) return; this.joy.on = true; this.joy.ox = ptr.x; this.joy.oy = ptr.y; });
    this.input.on('pointermove', (ptr) => { if (!this.joy.on) return; const dx = ptr.x - this.joy.ox, dy = ptr.y - this.joy.oy; const l = Math.hypot(dx, dy); const k = Math.min(1, l / 52); this.joy.x = l ? dx / l * k : 0; this.joy.y = l ? dy / l * k : 0; });
    this.input.on('pointerup', () => { this.joy.on = false; this.joy.x = this.joy.y = 0; });
    this.input.addPointer(1);
    this.offs = [
      on('pick', (id) => this.applyPick(id)),
      on('reroll', () => this.reroll()),
      on('block', (info) => this.blockDrop(info)),
      on('dash', () => { this.dashReq = true; }),
    ];
    this.events.once('shutdown', () => { this.offs.forEach((o) => o()); this.perfEl?.remove(); this.perfEl = null; if (window.__hr === this) window.__hr = null; });
    window.__hr = this;
    emit('runStart', { max: RUN_SECONDS });
    this.toast({ text: 'HAMSTER RUSH', sub: 'Survive the wheel · Space = dash', color: '#ffd23f', big: true });
    cam.fadeIn(250);
    if (qs.has('perf')) this.togglePerf();
  }

  // ------------------------------------------------------------------ debug / shims
  get enemies() { const s = this; return { countActive: () => s.en.length }; }
  get player() { return this.pl; }
  get p() { return Object.assign(this.P, { hp: this.hp }); }
  get boss() { return this.bosses[0] || null; }
  togglePost() { const v = this.vfx; v.setPost(!v.postOn); }
  togglePerf() {
    if (this.perfEl) { this.perfEl.remove(); this.perfEl = null; return; }
    const d = document.createElement('div'); d.id = 'perf'; document.body.appendChild(d); this.perfEl = d;
  }
  setQuality(q) { this.quality = q; this.vfx.setQuality(q); if (q < 2) this.vfx.setPost(false); }

  // ------------------------------------------------------------------ weapons
  addWeapon(id, lvl = 1) {
    const w = { id, lvl: 1, bonus: 0, evo: false, cd: 0.35, t: 0, n: 0 }; this.weapons.push(w); this.onWeaponAdd(w);
    for (let i = 1; i < lvl; i++) { w.lvl++; } this.onWeaponChange(w);
    return w;
  }
  recoil(a) { this.kick = 1; this.aimKick = a; }
  hitStopFor(s) { this.hitStopT = Math.max(this.hitStopT, s); }

  // ------------------------------------------------------------------ player support
  healAmt(n) { const h = Math.min(this.P.maxHp - this.hp, n); if (h <= 0.4) return; this.hp += h; this.vfx.num(this.px, this.py - 16, Math.round(h), 'g'); this.vfx.ring(this.px, this.py + 4, 16, 0x7dff7d, 0.35, 0.6); this.vfx.hit(this.px, this.py, 0x7dff7d, 5); }
  healPct(f) { this.healAmt(this.P.maxHp * f); }
  xpBurst(f) { this.gainXp(needXp(this.level) * f, true); }
  vacuum() { for (const g of this.gems) g.pull = true; this.vfx.ring(this.px, this.py, 120, 0x6ad0ff, 0.6, 0.7); }
  toast(o) { emit('toast', o); }
  dropGem(x, y, xp) {
    if (this.gems.length > 260) { this.gainXp(xp); return; }
    const tex = xp >= 8 ? 'gem3' : xp >= 3 ? 'gem2' : 'gem1', im = this.vfx.imgs.get(tex);
    const a = Math.random() * TAU, sp = 30 + Math.random() * 50;
    im.setScale(SC * (xp >= 8 ? 1.25 : 1)).setPosition(x, y).setDepth(120);
    this.gems.push({ im, x, y, val: xp, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20, pull: false, sp: 0, ph: Math.random() * 6, t: 0, z: 0 });
  }
  dropPickup(x, y, type) {
    const tex = type === 'heart' ? 'heart' : 'bchest', im = this.vfx.imgs.get(tex);
    im.setScale(SC * 1.1).setPosition(x, y).setDepth(121);
    this.pick.push({ im, x, y, type, t: 0, ph: Math.random() * 6 });
    this.vfx.ring(x, y, 18, type === 'chest' ? 0xffd23f : 0xff7a8a, 0.5, 0.8);
  }
  gainXp(v, exact) {
    this.xp += exact ? v : v * this.P.xp * (this.P.gem || 1);
    let n = needXp(this.level);
    while (this.xp >= n) { this.xp -= n; this.level++; this.queue++; n = needXp(this.level); this.levelFx(); }
    if (this.queue > 0 && !this.choosing && !this.finished) this.openLevelUp();
  }
  levelFx() {
    const v = this.vfx; sfx.level(); v.ring(this.px, this.py + 2, 54, 0xffe066, 0.55, 0.9); v.ring(this.px, this.py + 2, 34, 0x9fe8ff, 0.4, 0.8);
    v.glow(this.px, this.py, 40, 0xffe066, 0.4); v.burstSpark(this.px, this.py, 14, 0xffe066); v.shake(0.18); this.sqP = 0.2;
  }
  openLevelUp() {
    this.choosing = true; this.queue--;
    this.choices = buildOffer(this, this.P.cards);
    this.emitLevelUp(); this.scene.pause();
  }
  emitLevelUp() {
    emit('levelup', {
      level: this.level, rerolls: this.rerolls, choices: this.choices.map((c) => ({ id: c.cid, name: c.name, desc: c.desc, icon: c.icon, tag: c.tag, stack: c.stack, max: c.max, kind: c.kind, r: c.r, rarity: c.rarity, color: c.color })),
    });
  }
  applyPick(id) {
    if (!this.choosing) return;
    const c = this.choices.find((x) => x.cid === id) || this.choices.find((x) => x.idc === id); if (!c) return;
    const name = applyCard(this, c);
    this.choosing = false; this.choices = [];
    const col = '#' + c.color.toString(16).padStart(6, '0');
    this.toast({ text: name, sub: c.tag, color: typeof c.color === 'number' ? col : c.color, small: true });
    this.vfx.glow(this.px, this.py, 26, typeof c.color === 'number' ? c.color : 0xffffff, 0.4); sfx.click();
    emit('picked', { name });
    if (this.queue > 0) this.openLevelUp(); else this.scene.resume();
  }
  reroll() {
    if (!this.choosing || this.rerolls <= 0) return;
    this.rerolls--; this.choices = buildOffer(this, this.P.cards); this.emitLevelUp(); sfx.click();
  }
  blockDrop(info) {
    if (this.finished) return;
    const a = Math.random() * TAU; this.dropPickup(this.px + Math.cos(a) * 26, this.py + Math.sin(a) * 18, 'chest');
    this.toast({ text: 'NEW SQUEEKCHAIN BLOCK', sub: info?.height ? '#' + info.height + ' · golden chest dropped' : 'golden chest dropped', color: '#ffd23f', small: true });
  }

  // ------------------------------------------------------------------ player hit
  hurtPlayer(dmg, src, o = {}) {
    if (this.finished || this.cfg.god) return false;
    if (this.dashI > 0) return false;
    if (this.iframes > 0 && !o.gas) return false;
    if (o.gas && this.gasCd > 0) return false;
    dmg = Math.max(1, dmg * (1 - (this.P.armor || 0)));
    const v = this.vfx;
    this.hp -= dmg;
    if (o.gas) { this.gasCd = 0.35; } else { this.iframes = 0.7; this.hitStopFor(0.05); v.shake(0.4); this.flashT = 0.09; v.flashScreen(255, 40, 40, 90); emit('hurt', { hp: this.hp, dmg }); }
    this.combo = 0; this.sqP = 0.22; sfx.hurt();
    v.num(this.px, this.py - 14, Math.round(dmg), 'r'); v.hit(this.px, this.py, 0xff5a5a, 7);
    if (o.kx || o.ky) { const l = Math.hypot(o.kx, o.ky) || 1; this.vx += o.kx / l * 140; this.vy += o.ky / l * 140; }
    if (src && this.P.thorns && !src.dead) this.hurt(src, this.P.thorns, 0, 0, { col: 0xc8e86a });
    if (this.hp <= 0) {
      const w = this.perk.wind;
      if (w && w.left > 0) {
        w.left = 0; this.hp = Math.max(1, this.P.maxHp * w.pct); this.iframes = 2.2;
        v.ring(this.px, this.py, 110, 0xffffff, 0.8); v.glow(this.px, this.py, 70, 0xffffff, 0.6); v.shake(0.6); v.flashScreen(255, 255, 255, 200);
        this.clearEnemyShots(); this.toast({ text: 'SECOND WIND!', sub: 'you refuse to go down', color: '#9fe8ff', big: true });
        for (const e of this.en) { if (!e.dead && !e.boss) { const d = Math.hypot(e.x - this.px, e.y - this.py); if (d < 90) { e.kx += (e.x - this.px) / (d || 1) * 220; e.ky += (e.y - this.py) / (d || 1) * 220; } } }
      } else { this.hp = 0; this.finish(false); }
    }
    return true;
  }

  // ------------------------------------------------------------------ input
  inputVec() {
    let x = 0, y = 0;
    if (this.cursors.left.isDown || this.keys.A.isDown) x -= 1;
    if (this.cursors.right.isDown || this.keys.D.isDown) x += 1;
    if (this.cursors.up.isDown || this.keys.W.isDown) y -= 1;
    if (this.cursors.down.isDown || this.keys.S.isDown) y += 1;
    if (x || y) { const l = Math.hypot(x, y); return [x / l, y / l]; }
    if (this.joy.on) return [this.joy.x, this.joy.y];
    if (this.cfg.bot) return this.botVec();
    return [0, 0];
  }
  botVec() { // autopilot for tests: flee crowds, wander a long route
    let fx = 0, fy = 0; const en = this.en;
    for (let i = 0; i < en.length; i++) {
      const e = en[i]; if (e.dead) continue;
      const dx = this.px - e.x, dy = this.py - e.y, d2 = dx * dx + dy * dy;
      if (d2 < 90 * 90) { const w = 1 / (d2 + 30); fx += dx * w; fy += dy * w; }
    }
    const gx = START.x + Math.cos(this.t * 0.06) * 340, gy = START.y + Math.sin(this.t * 0.09) * 230;
    const tx = gx - this.px, ty = gy - this.py, tl = Math.hypot(tx, ty) || 1;
    fx += tx / tl * 0.012; fy += ty / tl * 0.012;
    const l = Math.hypot(fx, fy); return l ? [fx / l, fy / l] : [0, 0];
  }
  stepPlayer(dx, dy) {
    const w = this.world; let x = this.px, y = this.py;
    if (!w.deep(x + dx, y + 6)) x += dx;
    if (!w.deep(x, y + dy + 6)) y += dy;
    x = clamp(x, 10, W - 10); y = clamp(y, 10, H - 10);
    const o = w.resolve(x, y + 5, 5); this.px = o[0]; this.py = o[1] - 5;
  }

  // ------------------------------------------------------------------ hero visuals
  heroVisual(dt, moving, spd, ix, iy) {
    const pl = this.pl, v = this.vfx;
    // 8-way facing with hysteresis
    if (moving && this.dashT <= 0 || this.dashT > 0) {
      const a = Math.atan2(this.dashT > 0 ? this.dashDy : this.vy, this.dashT > 0 ? this.dashDx : this.vx);
      const cur = this.oct * Math.PI / 4;
      if (Math.abs(wrapA(a - cur)) > (22.5 + 8) * Math.PI / 180) {
        const o = (((Math.round(a / (Math.PI / 4))) % 8) + 8) % 8;
        if (o !== this.oct) { this.oct = o; this.sqP = Math.max(this.sqP, 0.1); if (moving) v.puff(this.px, this.py + 9, 2, 0xd9cdb0); }
      }
    }
    const [vw, mir] = DIR8[this.oct]; this.view = vw; this.mirror = mir;
    const key = 'h' + vw + (moving ? '_walk' : '_idle');
    if (key !== this.cur) {
      const idx = pl.anims.currentFrame ? pl.anims.currentFrame.index - 1 : 0;
      const keep = this.cur.slice(0, 2) !== key.slice(0, 2) && this.cur.slice(2) === key.slice(2);
      this.cur = key; pl.play({ key, startFrame: keep ? clamp(idx, 0, 7) : 0 });
    }
    pl.setFlipX(!!mir);
    pl.anims.timeScale = moving ? clamp(spd / this.P.speed, 0.55, 1.5) : 1;
    // squash/stretch: breathing, lean, hit, dash stretch
    this.sqP *= Math.exp(-dt * 11);
    const br = Math.sin(this.t * 3.4) * 0.018, lean = clamp(this.vx / this.P.speed, -1, 1) * 0.07;
    const ds = this.dashT > 0 ? 0.16 : 0;
    pl.setScale(SC * (1 - br * 0.7 + this.sqP + ds), SC * (1 + br - this.sqP * 0.9 - ds * 0.7)).setRotation(lean);
    pl.setPosition(this.px, this.py - (moving ? Math.abs(Math.sin(this.t * 17)) * 0.6 : 0)).setDepth(100 + (this.py + 10) * 0.05);
    // hit flash / i-frame blink / dash ghost tint
    if (this.flashT > 0) { this.flashT -= dt; pl.setTintFill(0xffffff); }
    else { pl.clearTint(); if (this.dashT > 0) pl.setTint(0xbfeaff); }
    pl.setAlpha(this.iframes > 0 && this.dashT <= 0 && Math.floor(this.t * 22) % 2 === 0 ? 0.45 : 1);
    this.shadow.setPosition(this.px, this.py + 11).setScale(1 + this.sqP * 0.6, 1);
    this.ring.setPosition(this.px, this.py + 11);
    if (this.cfg.glow) this.ring.setStrokeStyle(1.5, this.cfg.glow, 0.6 + Math.sin(this.t * 4) * 0.3);
    // cannon prop follows the aim, with recoil
    const a = this.aim, c = Math.cos(a), s = Math.sin(a);
    this.kick = Math.max(0, this.kick - dt * 9); const kk = this.kick * this.kick * 2.6;
    const front = s > -0.35;
    this.cannon.setPosition(this.px + c * (3 - kk) + (c >= 0 ? 0 : 0), this.py + 3 + s * 2.5 - kk * s).setRotation(a).setFlipY(c < 0).setDepth(100 + (this.py + 10) * 0.05 + (front ? 0.02 : -0.02));
    this.cannon.setAlpha(pl.alpha).setVisible(true);
    // footstep dust
    if (moving && this.dashT <= 0) { this.stepT -= dt; if (this.stepT <= 0) { this.stepT = 0.2 * this.P.speed / Math.max(30, spd); v.puff(this.px - ix * 4, this.py + 10, 1, 0xcbbf9c); } }
  }

  // ------------------------------------------------------------------ main loop
  update(_, delta) {
    const t0 = performance.now();
    const rdt = Math.min(delta, 50) / 1000;
    if (this.finished) { this.vfx.update(rdt); this.cameraStep(rdt); return; }
    let dt = rdt * this.speedMul;
    if (this.hitStopT > 0) { this.hitStopT -= rdt; dt *= 0.06; }
    this.t += dt; this.frameN++;
    const P = this.P;
    // ---- player movement (+ dash)
    if (this.iframes > 0) this.iframes -= dt;
    if (this.gasCd > 0) this.gasCd -= dt;
    if (this.dashCdT > 0) this.dashCdT -= dt;
    let [ix, iy] = this.inputVec();
    if (ix || iy) { this.fdx = ix; this.fdy = iy; }
    if ((this.dashReq || Phaser.Input.Keyboard.JustDown(this.keys.SPACE) || Phaser.Input.Keyboard.JustDown(this.keys.SHIFT)) && this.dashCdT <= 0 && this.dashT <= 0) {
      this.dashReq = false; this.dashT = P.dashLen; this.dashI = P.dashLen + 0.11; this.dashCdT = P.dashCd; this.afterT = 0;
      const l = Math.hypot(this.fdx, this.fdy) || 1; this.dashDx = this.fdx / l; this.dashDy = this.fdy / l; this.sqP = 0.16;
      sfx.beep(520, 0.09, 'square', 0.03, 620); this.vfx.ring(this.px, this.py + 8, 16, 0x9fe8ff, 0.3, 0.7); this.vfx.puff(this.px, this.py + 9, 4, 0xe6dcc0);
    } else this.dashReq = false;
    if (this.dashI > 0) this.dashI -= dt;
    if (this.dashT > 0) {
      this.dashT -= dt; const sp = P.speed * 3.4;
      this.vx = this.dashDx * sp; this.vy = this.dashDy * sp;
      this.afterT -= dt; if (this.afterT <= 0) { this.afterT = 0.028; const r = this.vfx.sprite(this.pl.texture.key, this.px, this.py, { s0: SC, s1: SC * 0.92, a0: 0.5, a1: 0, dur: 0.26, tint: 0x8fdcff, depth: 99 }); if (r) { r.im.setFlipX(this.pl.flipX); r.im.setFrame(this.pl.frame.name); } }
    } else {
      const kv = 1 - Math.exp(-dt * 16);
      this.vx += (ix * P.speed * this.pslow - this.vx) * kv; this.vy += (iy * P.speed * this.pslow - this.vy) * kv;
    }
    this.stepPlayer(this.vx * dt, this.vy * dt);
    const spd = Math.hypot(this.vx, this.vy), moving = spd > 9;
    if (moving) this.stillT = 0; else this.stillT += dt;
    if (P.regen) this.hp = Math.min(P.maxHp, this.hp + P.regen * dt);
    if (P.cozy && this.stillT > 0.6) this.hp = Math.min(P.maxHp, this.hp + P.cozy * dt);
    this.pslow = Math.min(1, this.pslow + dt * 2.5);

    // ---- world update
    this.runLater(dt);
    this.reap(); this.buildGrid();
    this.tgt = this.nearest(this.px, this.py, 230);
    if (this.tgt) { const a = Math.atan2(this.tgt.y - this.py, this.tgt.x - this.px); this.aim = this.aim + clamp(wrapA(a - this.aim), -dt * 18, dt * 18); }
    else if (moving) this.aim = this.aim + clamp(wrapA(Math.atan2(this.vy, this.vx) - this.aim), -dt * 9, dt * 9);
    this.updateEnemies(dt);
    this.updateWeapons(dt);
    this.updateEnemyShots(dt);
    this.updateZones(dt);
    this.director(dt);
    this.updateLoot(dt);
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }
    this.drawBars();
    this.heroVisual(dt, moving, spd, ix, iy);
    this.vfx.update(rdt);
    this.cameraStep(rdt);
    this.world.stream(this.cameras.main, this.px, this.py); this.world.update(rdt, this.t, this.px, this.py, this.cameras.main);

    this.hudT -= rdt;
    if (this.hudT <= 0) { this.hudT = 0.1; this.drawJoy(); this.emitHud(); }
    if (this.t >= RUN_SECONDS) this.finish(true);
    this.perfTick(rdt, performance.now() - t0);
  }
  cameraStep(rdt) {
    const kc = 1 - Math.exp(-rdt * 5.2), cam = this.cameras.main, v = this.vfx;
    this.camX += (this.px + this.vx * 0.3 - this.camX) * kc; this.camY += (this.py + this.vy * 0.3 - this.camY) * kc;
    cam.centerOn(Math.round(clamp(this.camX, 240, W - 240) * 2) / 2 + v.ox, Math.round(clamp(this.camY, 135, H - 135) * 2) / 2 + v.oy);
  }

  // ------------------------------------------------------------------ loot (gems, hearts, chests)
  updateLoot(dt) {
    const gems = this.gems, px = this.px, py = this.py, mag = this.P.magnet, v = this.vfx;
    for (let i = gems.length - 1; i >= 0; i--) {
      const g = gems[i]; g.t += dt;
      const dx = px - g.x, dy = py - g.y, d2 = dx * dx + dy * dy;
      if (g.t > 0.25 && (g.pull || d2 < mag * mag)) { g.pull = true; g.sp = Math.min(260, g.sp + 700 * dt); const d = Math.sqrt(d2) || 1; g.vx = dx / d * g.sp; g.vy = dy / d * g.sp; }
      else { g.vx *= Math.exp(-dt * 5); g.vy *= Math.exp(-dt * 5); }
      g.x += g.vx * dt; g.y += g.vy * dt;
      if (g.t > 0.25 && d2 < 100) {
        this.gainXp(g.val); this.gemsGot++; sfx.gem();
        v.hit(g.x, g.y, g.val >= 8 ? 0xff7a7a : g.val >= 3 ? 0x7dff9a : 0x7fd8ff, 2); v.imgs.put(g.im); const last = gems.pop(); if (i < gems.length) gems[i] = last; continue;
      }
      g.im.setPosition(g.x, g.y + Math.sin(this.t * 5 + g.ph) * 0.9).setAlpha(1);
    }
    const pk = this.pick;
    for (let i = pk.length - 1; i >= 0; i--) {
      const it = pk[i]; it.t += dt;
      const dx = px - it.x, dy = py - it.y, d2 = dx * dx + dy * dy;
      if (d2 < mag * mag * 0.5 && it.t > 0.4) { const d = Math.sqrt(d2) || 1, s = 90 * dt; it.x += dx / d * s; it.y += dy / d * s; }
      it.im.setPosition(it.x, it.y + Math.sin(this.t * 4 + it.ph) * 1.6).setScale(SC * (1.1 + Math.sin(this.t * 6 + it.ph) * 0.05));
      if (it.type === 'chest' && Math.random() < dt * 5) v.sprite('fx_star', it.x + (Math.random() - 0.5) * 14, it.y - 4 - Math.random() * 6, { s0: 0.35, s1: 0, dur: 0.5, vy: -14, tint: 0xffe066 });
      if (d2 < 169) {
        if (it.type === 'heart') { this.healPct(0.25); sfx.gem(); }
        else { sfx.chest(); this.gainXp(Math.max(1, needXp(this.level) - this.xp) + 0.01, true); this.healPct(0.15); v.ring(px, py, 70, 0xffd23f, 0.6); v.burstSpark(px, py, 18, 0xffd23f); this.toast({ text: 'GOLDEN CHEST!', sub: 'free level-up', color: '#ffd23f', small: true }); }
        v.imgs.put(it.im); const last = pk.pop(); if (i < pk.length) pk[i] = last;
      }
    }
  }

  // ------------------------------------------------------------------ HUD / perf
  emitHud() {
    const P = this.P, en = this.en, bs = this.bosses;
    const mm = []; let n = 0;
    for (let i = 0; i < en.length && n < 90; i++) {
      const e = en[i]; if (e.dead) continue; const dx = e.x - this.px, dy = e.y - this.py;
      if (dx * dx + dy * dy < 260 * 260) { mm.push(dx | 0, dy | 0, e.boss ? 3 : e.elite ? 2 : 1); n++; }
    }
    const b = bs[0], nextBoss = BOSS_SCHEDULE.find(([tt, k]) => !this.bossKilled[k] && tt > this.t);
    emit('hud', {
      hp: this.hp, maxHp: P.maxHp, xp: this.xp, need: needXp(this.level), level: this.level, t: this.t, kills: this.kills, enemies: en.length,
      combo: this.combo, comboF: Math.max(0, this.comboT / 3), dash: this.dashCdT > 0 ? 1 - this.dashCdT / P.dashCd : 1, score: this.score(), rerolls: this.rerolls,
      weapons: this.weapons.map((w) => ({ id: w.id, icon: WEAPONS[w.id].icon, lvl: w.lvl, evo: w.evo, cd: this.wcdFrac(w) })),
      pass: Object.keys(this.pass).map((id) => ({ id, icon: PASSIVES[id].icon, lvl: this.pass[id].lvl })).concat(Object.keys(this.perk).filter((id) => PERKS[id].max > 1).map((id) => ({ id, icon: PERKS[id].icon, lvl: this.perk[id].n }))),
      boss: b ? { name: b.d.name, ratio: b.hp / b.mhp, phase: b.phase || 0 } : null, nextBoss: nextBoss ? nextBoss[0] - this.t : null, mm,
    });
    if (b) emit('boss', b.hp / b.mhp); else if (this._hadBoss) emit('boss', null);
    this._hadBoss = !!b;
  }
  score() { return Math.round(this.kills * 10 + this.level * 100 + this.t * 5 + this.bossKills * 1500 + this.eliteKills * 50); }
  drawJoy() {
    const g = this.joyG; g.clear();
    if (!this.joy.on) return;
    const X = (v) => v / 2 + 240, Y = (v) => v / 2 + 135;
    g.lineStyle(1, 0xffffff, 0.5).strokeCircle(X(this.joy.ox), Y(this.joy.oy), 26);
    g.fillStyle(0xffffff, 0.45).fillCircle(X(this.joy.ox + this.joy.x * 52), Y(this.joy.oy + this.joy.y * 52), 8);
  }
  perfTick(rdt, ms) {
    const f = this.perf; f.acc += ms; f.n++; f.worst = Math.max(f.worst, ms); f.win += rdt; f.wn++;
    if (f.win >= 1) {
      f.ms = f.acc / f.n; f.fps = this.game.loop.actualFps; f.avgDt = f.win / f.wn; f.acc = 0; f.n = 0; f.win = 0; f.wn = 0;
      if (this.perfEl) this.perfEl.textContent = `${f.fps.toFixed(0)} fps · js ${f.ms.toFixed(1)} ms (worst ${f.worst.toFixed(0)}) · en ${this.en.length} pj ${this.pj.length} fx ${this.vfx.fx.length} gems ${this.gems.length} · q${this.quality}${this.vfx.postOn ? ' bloom' : ''}`;
      f.worst = 0;
      if (!qs.has('nodegrade') && this.t > 8) {
        if (f.fps < 38) { f.slow++; if (f.slow >= 4 && this.quality > 0) { f.slow = 0; this.setQuality(this.quality - 1); } } else f.slow = Math.max(0, f.slow - 1);
      }
    }
  }

  // ------------------------------------------------------------------ end of run
  finish(win) {
    if (this.finished) return;
    this.finished = true; this.choosing = false;
    const sc = this.score() + (win ? 2000 : 0);
    for (const e of this.en) { if (!e.dead) { e.setTint(0x777777); e.anims.pause(); } }
    this.pl.anims.pause();
    const summary = {
      win, time: Math.min(this.t, RUN_SECONDS), kills: this.kills, level: this.level,
      seeds: Math.round(this.seedsEarned + this.t * 0.25 + (win ? 30 : 0) + (this.bossDead ? 25 : 0)),
      bossDead: this.bossDead, gems: this.gemsGot, score: sc, bosses: this.bossKills, elites: this.eliteKills, maxCombo: this.maxCombo,
      weapons: this.weapons.map((w) => ({ id: w.id, name: WEAPONS[w.id].name, icon: WEAPONS[w.id].icon, lvl: w.lvl, evo: w.evo })), taken: { ...Object.fromEntries(Object.entries(this.pass).map(([k, v]) => [k, v.lvl])), ...Object.fromEntries(Object.entries(this.perk).map(([k, v]) => [k, v.n])) },
    };
    emit('boss', null);
    if (!win) { this.vfx.boom(this.px, this.py, 50, 0xff6a3a, { shake: 0.7 }); this.pl.setVisible(false); this.cannon.setVisible(false); }
    this.cameras.main.fadeOut(win ? 400 : 900, 0, 0, 0);
    this.time.delayedCall(win ? 450 : 950, () => emit('runEnd', summary));
  }
}

Object.assign(GameScene.prototype, WeaponMethods, EnemyMethods);

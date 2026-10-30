// Animated DOM HUD + level-up cards. Driven by bus events: hud (10 Hz), hurt, toast, levelup, boss.
import { emit, on } from './bus.js';
import { spriteURL, spriteCanvas } from './sprites.js';
import { RARITY } from './defs.js';
import { RUN_SECONDS } from './game.js';
import { sfx } from './sfx.js';
import { music } from './music.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const urls = new Map();
const icon = (k) => { let u = urls.get(k); if (!u) { try { u = spriteURL(k); } catch { u = ''; } urls.set(k, u); } return u; };
const css = (c) => (typeof c === 'number' ? '#' + c.toString(16).padStart(6, '0') : c || '#ffffff');
const fmt = (n) => Math.round(n).toLocaleString('en-US');

const H = { lastLv: 1, lastHp: 1, slotSig: '', passSig: '', shown: { kills: 0, score: 0 }, tgt: { kills: 0, score: 0 }, raf: 0, lastToast: '', lastToastT: 0, phase: -1, boss: false, comboN: 0 };

export function initHud() {
  const pc = $('pt-cv'); if (pc) { const c = pc.getContext('2d'); c.imageSmoothingEnabled = false; H.pc = c; paintPortrait('hf_w0'); }
  $('btn-dash')?.addEventListener('pointerdown', (e) => { e.preventDefault(); emit('dash'); });
  if ('ontouchstart' in window || new URLSearchParams(location.search).has('touch')) $('btn-dash')?.classList.remove('hidden');
  on('hud', updateHud);
  on('toast', toast);
  on('hurt', onHurt);
  on('runStart', resetHud);
  on('levelup', showLevelUp);
  on('picked', () => { /* handled by toasts */ });
}

function paintPortrait(key) {
  if (!H.pc) return;
  try { const s = spriteCanvas(key); H.pc.clearRect(0, 0, 48, 48); const r = Math.min(46 / s.width, 46 / s.height); const w = s.width * r, h = s.height * r; H.pc.drawImage(s, (48 - w) / 2, 47 - h, w, h); } catch { /* sprite not ready */ }
}

export function resetHud() {
  H.lastLv = 1; H.slotSig = ''; H.passSig = ''; H.shown.kills = H.shown.score = H.tgt.kills = H.tgt.score = 0; H.boss = false; H.phase = -1; H.comboN = 0;
  $('toasts').innerHTML = ''; $('wslots').innerHTML = ''; $('pslots').innerHTML = ''; $('combo').classList.add('hidden'); $('boss').classList.add('hidden');
  $('hp-fill').style.width = '100%'; $('hp-trail').style.width = '100%'; $('xp-fill').style.width = '0%'; paintPortrait('hf_w0');
  document.getElementById('hud').classList.remove('low');
  if (!H.raf) H.raf = requestAnimationFrame(roll);
}

function roll() {
  const hud = $('hud');
  if (!hud || hud.classList.contains('hidden')) { H.raf = 0; return; }
  for (const k of ['kills', 'score']) {
    const d = H.tgt[k] - H.shown[k];
    if (d !== 0) { H.shown[k] += Math.abs(d) < 1 ? d : d * 0.22 + Math.sign(d) * 0.4; if (Math.abs(H.tgt[k] - H.shown[k]) < 1) H.shown[k] = H.tgt[k]; $(k).textContent = fmt(H.shown[k]); }
  }
  H.raf = requestAnimationFrame(roll);
}

function bump(el, cls = 'pop') { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

function onHurt(d) {
  const h = $('hurt'); bump(h, 'on'); bump($('portrait'), 'ouch');
  paintPortrait('hq_w1'); setTimeout(() => paintPortrait(H.lastHp < 0.3 ? 'hs_w0' : 'hf_w0'), 260);
  bump($('hud'), 'shake');
}

function updateHud(d) {
  if (!H.raf) H.raf = requestAnimationFrame(roll);
  const hr = Math.max(0, d.hp / d.maxHp), hudEl = $('hud');
  $('hp-fill').style.width = hr * 100 + '%'; $('hp-trail').style.width = hr * 100 + '%';
  $('hp-txt').textContent = `${Math.ceil(d.hp)} / ${Math.round(d.maxHp)}`;
  const segs = Math.max(4, Math.min(16, Math.round(d.maxHp / 15))); $('hpwrap-segs') || (document.querySelector('.hpbar .segs').style.setProperty('--n', segs));
  if (hr < 0.3 !== hudEl.classList.contains('low')) { hudEl.classList.toggle('low', hr < 0.3); if (hr >= 0.3) paintPortrait('hf_w0'); }
  if (H.lastHp >= 0.3 && hr < 0.3) paintPortrait('hs_w0');
  H.lastHp = hr;
  const xr = Math.min(1, d.xp / d.need); $('xp-fill').style.width = xr * 100 + '%'; $('xp-txt').textContent = '';
  if (d.level !== H.lastLv) { H.lastLv = d.level; $('lv').textContent = d.level; bump($('lvbadge')); bump($('xpbar'), 'flash'); }
  H.tgt.kills = d.kills; H.tgt.score = d.score;
  const left = Math.max(0, RUN_SECONDS - d.t), t = $('timer');
  t.textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`; t.classList.toggle('urgent', left < 30);
  $('dash-fill').style.transform = `scaleX(${Math.max(0, Math.min(1, d.dash))})`; $('dashrow').classList.toggle('ready', d.dash >= 1);
  const nb = $('nextboss');
  if (d.boss) nb.textContent = ''; else if (d.nextBoss != null && d.nextBoss < 25) { nb.textContent = `⚠ boss in ${Math.ceil(d.nextBoss)}s`; nb.classList.add('warn'); } else { nb.textContent = d.nextBoss != null ? `next boss ${Math.floor(d.nextBoss / 60)}:${String(Math.floor(d.nextBoss % 60)).padStart(2, '0')}` : ''; nb.classList.remove('warn'); }
  // boss bar
  const bs = $('boss');
  if (d.boss) {
    if (!H.boss) { H.boss = true; bs.classList.remove('hidden'); bump(bs, 'in'); $('boss-name').textContent = d.boss.name.toUpperCase(); }
    $('boss-fill').style.width = Math.max(0, d.boss.ratio) * 100 + '%'; $('boss-trail').style.width = Math.max(0, d.boss.ratio) * 100 + '%';
    if (d.boss.phase !== H.phase) { H.phase = d.boss.phase; $('boss-ph').textContent = d.boss.phase > 0 ? 'PHASE ' + (d.boss.phase + 1) : ''; if (d.boss.phase > 0) bump(bs, 'rage'); }
  } else if (H.boss) { H.boss = false; bs.classList.add('hidden'); H.phase = -1; }
  // combo
  const cb = $('combo');
  if (d.combo >= 3 && d.comboF > 0) { if (cb.classList.contains('hidden')) cb.classList.remove('hidden'); if (d.combo !== H.comboN) { $('combo-n').textContent = 'x' + d.combo; bump($('combo-n')); H.comboN = d.combo; } $('combo-f').style.transform = `scaleX(${d.comboF})`; }
  else { cb.classList.add('hidden'); H.comboN = 0; }
  // slots
  const wsig = d.weapons.map((w) => w.id + w.lvl + (w.evo ? 'e' : '')).join();
  if (wsig !== H.slotSig) {
    const grow = H.slotSig && d.weapons.length >= H.slotSig.split(',').length;
    H.slotSig = wsig;
    $('wslots').innerHTML = d.weapons.map((w) => `<div class="slot${w.evo ? ' evo' : ''}"><img class="px" src="${icon(w.icon)}"><div class="cd"></div><div class="pips">${pips(w.lvl, 8)}</div></div>`).join('');
    if (grow) { const k = $('wslots').lastElementChild; k && bump(k, 'slotin'); }
  }
  const cds = $('wslots').children; for (let i = 0; i < cds.length && i < d.weapons.length; i++) cds[i].firstElementChild.nextElementSibling.style.setProperty('--cd', Math.max(0, Math.min(1, d.weapons[i].cd)) * 360 + 'deg');
  const psig = d.pass.map((p) => p.id + p.lvl).join();
  if (psig !== H.passSig) { H.passSig = psig; $('pslots').innerHTML = d.pass.map((p) => `<div class="slot p"><img class="px" src="${icon(p.icon)}">${p.lvl > 1 ? `<i>${p.lvl}</i>` : ''}</div>`).join(''); }
  drawMap(d.mm);
}
const pips = (n, max) => Array.from({ length: Math.min(max, n) }, () => '<u></u>').join('');

function drawMap(mm) {
  const cv = $('minimap'); if (!cv) return; const c = cv.getContext('2d'), W = cv.width, R = W / 2;
  c.clearRect(0, 0, W, W); c.fillStyle = 'rgba(8,18,10,.55)'; c.beginPath(); c.arc(R, R, R - 1, 0, 6.2832); c.fill();
  c.strokeStyle = 'rgba(160,220,150,.25)'; c.lineWidth = 1; c.beginPath(); c.arc(R, R, R * 0.5, 0, 6.2832); c.stroke();
  const k = (R - 4) / 260;
  for (let i = 0; i < mm.length; i += 3) {
    const x = R + mm[i] * k, y = R + mm[i + 1] * k, t = mm[i + 2];
    c.fillStyle = t === 3 ? '#ff3a3a' : t === 2 ? '#ffb82e' : '#e86a5a'; const s = t === 3 ? 5 : t === 2 ? 3 : 2; c.fillRect(x - s / 2, y - s / 2, s, s);
  }
  c.fillStyle = '#7dff7d'; c.fillRect(R - 2, R - 2, 4, 4);
  c.strokeStyle = 'rgba(0,0,0,.7)'; c.lineWidth = 2; c.beginPath(); c.arc(R, R, R - 1, 0, 6.2832); c.stroke();
}

// ---------------------------------------------------------------- toasts
export function toast(msg) {
  const o = typeof msg === 'string' ? { text: msg } : msg || {}; if (!o.text) return;
  const now = performance.now(); if (o.text === H.lastToast && now - H.lastToastT < 700) return; H.lastToast = o.text; H.lastToastT = now;
  const box = $('toasts'); const el = document.createElement('div');
  el.className = 'toast' + (o.big ? ' big' : '') + (o.small ? ' small' : ''); el.style.setProperty('--c', o.color || '#ffd23f');
  el.innerHTML = `<b>${esc(o.text)}</b>${o.sub ? `<span>${esc(o.sub)}</span>` : ''}`;
  box.appendChild(el); while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => el.remove(), o.big ? 3200 : 2300);
}

// ---------------------------------------------------------------- level-up
export function showLevelUp(d) {
  const root = $('levelup');
  $('lu-level').textContent = '→ ' + d.level; $('lu-rr').textContent = d.rerolls;
  $('lu-reroll').classList.toggle('hidden', d.rerolls <= 0);
  const best = Math.max(0, ...d.choices.map((c) => c.r || 0));
  root.dataset.top = String(best);
  $('lu-sub').textContent = `Pick an upgrade (${d.choices.map((_, i) => i + 1).join(' / ')})`;
  $('lu-cards').innerHTML = d.choices.map((c, i) => {
    const R = RARITY[c.r || 0] || RARITY[0], col = css(c.color || R.color);
    const tag = c.tag === 'EVOLVE' || /evol/i.test(c.tag || '') ? 'evolve' : /new/i.test(c.tag || '') ? 'new' : '';
    const pipsHtml = c.max > 1 && c.max <= 10 ? `<div class="pips big">${Array.from({ length: c.max }, (_, k) => `<u class="${k < c.stack ? 'on' : k === c.stack ? 'nx' : ''}"></u>`).join('')}</div>` : '';
    return `<div class="ucard r${c.r || 0} ${tag}" data-id="${esc(c.id)}" style="--c:${col};--d:${i * 0.07}s"><div class="rl">${esc(R.name)}</div><div class="ico-wrap"><i class="halo"></i><img class="px" src="${icon(c.icon)}"></div>${c.tag ? `<em class="tag">${esc(c.tag)}</em>` : ''}<h3>${esc(c.name)}</h3><p>${esc(c.desc)}</p>${pipsHtml}<div class="key">[${i + 1}]</div></div>`;
  }).join('');
  root.querySelectorAll('.ucard').forEach((c) => { c.onclick = () => { sfx.click(); root.classList.add('hidden'); emit('pick', c.dataset.id); }; });
  root.classList.remove('hidden'); music.duck(true);
}

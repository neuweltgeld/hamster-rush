import { emit, on } from './bus.js';
import { load, save, PERMS, permCost } from './save.js';
import { RARITIES, SLOTS, rarityOf, itemStat, equipBonus, rollChest, claimItem } from './loot.js';
import { spriteURL, spriteCanvas } from './sprites.js';
import { sfx } from './sfx.js';
import { music } from './music.js';
import * as chain from './chain.js';
import { RUN_SECONDS } from './game.js';
import { initHud } from './hud.js';
import * as api from './api.js';
import { initDash } from './dash.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => (typeof n === 'bigint' ? n.toLocaleString('en-US') : Number(n).toLocaleString('en-US'));
const short = (a) => a.slice(0, 6) + '…' + a.slice(-4);
const q = new URLSearchParams(location.search);

export const S = {
  game: null, wheel: null, wheelBusy: false,
  wallet: { address: null, readOnly: false, chainOk: true, status: '', squeeks: null, boost: null, busy: false, auth: 'none', authMsg: '' },
  running: false, lastSummary: null, chestRoll: null,
};

export function initUI(game) {
  S.game = game;
  const logo = $('logo-ham'); logo.getContext('2d').drawImage(spriteCanvas('ham0'), 0, 0);
  renderAll();
  // PLAY: DOM button; pointerup + click + keyboard, guarded against double-firing (S.running check in startRun)
  const play = (e) => { if (e) e.preventDefault?.(); if (S.running) return; sfx.unlock(); sfx.click(); startRun(); };
  const bp = $('btn-play');
  bp.addEventListener('pointerup', (e) => { if (e.button === 0 || e.pointerType === 'touch' || e.pointerType === 'pen') play(e); });
  bp.addEventListener('click', play);
  $('btn-refresh').onclick = () => refreshWheel(true);
  $('btn-sound').onclick = () => { const s = load(); s.sound = !s.sound; save(); sfx.setEnabled(s.sound); sfx.unlock(); renderSound(); };
  initMusicUI();
  $('btn-pause').onclick = () => setPause(true);
  $('pz-resume').onclick = () => setPause(false);
  $('pz-menu').onclick = () => { setPause(false, true); toMenu(); };
  $('btn-open').onclick = openChest;
  $('btn-again').onclick = () => startRun();
  $('btn-tomenu').onclick = () => toMenu();
  $('lu-reroll').onclick = () => emit('reroll');
  sfx.setEnabled(load().sound); renderSound();

  initHud();
  on('pick', () => music.duck(false));
  initDash();
  $('btn-board') && ($('btn-board').onclick = () => emit('dash:open', 'lb'));
  $('btn-dashboard') && ($('btn-dashboard').onclick = () => emit('dash:open'));
  on('runEnd', (sum) => { music.duck(false); music.stinger(sum.win); music.play('menu', { fade: 2.2 }); showResult(sum); });
  on('boss', (r) => {
    const g = S.game.scene.getScene('Game');
    if (r != null) { if (!bossMusic) { bossMusic = true; music.play('boss', { fade: 0.9 }); } }
    else if (bossMusic) { bossMusic = false; if (S.running && !g?.finished) music.play('battle', { fade: 1.6 }); }
  });
  window.addEventListener('keydown', (e) => {
    if (!$('levelup').classList.contains('hidden')) {
      if (['1', '2', '3', '4', '5'].includes(e.key)) { const c = document.querySelectorAll('#lu-cards .ucard')[+e.key - 1]; c?.click(); }
      if (e.key.toLowerCase() === 'r') emit('reroll');
      return;
    }
    if (S.running && (e.key === 'Escape' || e.key.toLowerCase() === 'p')) setPause($('pause').classList.contains('hidden'));
    else if (!S.running && !$('menu').classList.contains('hidden') && (e.key === 'Enter' || e.key === ' ' || e.code === 'Space')) {
      const t = e.target, tag = t && t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SUMMARY' || (tag === 'BUTTON' && t.id !== 'btn-play')) return; // don't interfere with another control's own Enter/Space
      e.preventDefault(); play();
    }
  });
  window.addEventListener('blur', () => { if (S.running && $('levelup').classList.contains('hidden') && $('result').classList.contains('hidden')) setPause(true); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && S.running && $('levelup').classList.contains('hidden') && $('result').classList.contains('hidden')) setPause(true); });
}

// ------------------------------------------------------------ Menu render
export function renderAll() { renderWheel(); renderWallet(); renderProgress(); renderShop(); updateChip(); }
let bossMusic = false;
function initMusicUI() {
  const btns = [...document.querySelectorAll('.mus-btn')], sl = [...document.querySelectorAll('.mus-vol')];
  const paint = () => { btns.forEach((b) => { b.textContent = '♪ music: ' + (music.muted ? 'off' : 'on'); }); sl.forEach((r) => { r.value = Math.round(music.volume * 100); r.style.opacity = music.muted ? 0.45 : 1; }); };
  btns.forEach((b) => { b.onclick = () => { music.toggleMute(); sfx.unlock(); paint(); }; });
  sl.forEach((r) => { r.oninput = () => { music.setVolume(r.value / 100); paint(); }; });
  window.addEventListener('keydown', (e) => { if ((e.key === 'm' || e.key === 'M') && !e.repeat && !e.ctrlKey && !e.metaKey) { music.toggleMute(); paint(); } });
  paint();
  music.play('menu');
}
function renderSound() { $('btn-sound').textContent = 'sound: ' + (load().sound ? 'on' : 'off'); }

export function renderWheel() {
  const w = S.wheel, el = $('wheel-body');
  if (S.wheelBusy && !w) { el.innerHTML = '<span class="mut">Reading chain…</span>'; return; }
  if (!w) { el.innerHTML = '<span class="mut">—</span>'; return; }
  if (!w.ok) {
    el.innerHTML = `<div class="bad">Could not read chain: ${esc(w.error || 'unknown error')}</div>
      <div class="mut">No problem: the game works fully in offline mode, just without the wheel bonus.</div>
      <div class="row"><span>Hamster Rush bonus</span><b><span class="tier offline">OFFLINE</span></b></div>`;
    return;
  }
  const b = w.bonus, lagH = Math.round(Number(w.lagRounds) * 10 / 60);
  el.innerHTML = `
    <div class="row"><span>Network</span><b>Sepolia (${w.chainId}) ${w.verified === true ? '<span class="ok">✓ verified</span>' : w.verified === false ? '<span class="bad">⚠ does not match registry</span>' : '<span class="mut">unverified</span>'}</b></div>
    <div class="row"><span>Squeek block height</span><b>#${fmt(w.height)} <span class="mut">(+${w.progressPct}%)</span></b></div>
    <div class="row"><span>Ethereum block (snapshot)</span><b>${fmt(w.blockNumber)}</b></div>
    <div class="row"><span>Wheel work, last 24h (settled)</span><b>${fmt(w.workWindow)} work · ${w.activeRounds} active rounds</b></div>
    <div class="row"><span>Vs. average</span><b>×${w.ratio.toFixed(2)}</b></div>
    <div class="row"><span>Settlement lag</span><b class="${lagH > 12 ? 'mut' : ''}">${fmt(w.lagRounds)} rounds (~${lagH} h)</b></div>
    <div class="row"><span>Core</span><b>${w.paused ? '<span class="bad">PAUSED</span>' : 'active'}</b></div>
    <div class="row"><span>Hamster Rush bonus</span><b><span class="tier ${b.tier}">${esc(b.label)}</span></b></div>
    <div class="mut">${esc(b.desc)}</div>
    <div class="mut" style="font-size:10px">Data ${new Date(w.at).toLocaleTimeString('en-US')} · wheel data is read from the most recently settled rounds</div>`;
}

export function renderWallet() {
  const W = S.wallet, el = $('wallet-body');
  let h = '';
  if (!W.address) {
    h += `<div class="mut">Your Squeek NFTs boost your starting stats. Connecting is read-only; signing in (a free message signature — no gas, no approvals) puts you on the leaderboard.</div>
      <div class="btnrow" style="justify-content:flex-start"><button id="btn-connect" ${W.busy ? 'disabled' : ''}>${W.busy ? 'connecting…' : 'Connect wallet'}</button></div>
      <details style="margin-top:6px"><summary class="mut">or enter an address (read-only)</summary><input id="addr-in" class="addr" placeholder="0x…" spellcheck="false" /><button id="btn-addr" class="mini">Read my Squeeks</button></details>`;
    if (W.status) h += `<div class="${W.error ? 'bad' : 'mut'}" style="margin-top:6px">${esc(W.status)}</div>`;
  } else {
    h += `<div class="row"><span>${W.readOnly ? 'Address (read-only)' : 'Connected'}</span><b>${short(W.address)}</b></div>`;
    h += `<div class="row"><span>Network</span><b>${W.chainOk ? '<span class="ok">Sepolia ✓</span>' : '<span class="bad">wrong network</span>'}</b></div>`;
    if (!W.readOnly) {
      if (W.auth === 'ok') h += `<div class="auth-row"><span class="authbadge ok">✔ signed in · on the leaderboard</span></div>`;
      else if (W.auth === 'busy') h += `<div class="auth-row"><span class="authbadge warn">confirm the signature in your wallet…</span></div>`;
      else h += `<div class="auth-row"><button id="btn-signin" class="mini">✍ Sign in for the leaderboard</button>${W.authMsg ? `<span class="${W.auth === 'err' ? 'bad' : 'mut'}">${esc(W.authMsg)}</span>` : ''}</div>`;
    }
    if (!W.chainOk && !W.readOnly) h += `<button id="btn-switch" class="mini">Switch to Sepolia</button>`;
    if (W.busy) h += `<div class="mut">Scanning Squeeks… ${esc(W.status)}</div>`;
    else if (W.squeeks) {
      const s = W.squeeks;
      h += `<div class="row"><span>Squeek count</span><b>${s.balance}</b></div>`;
      if (s.tokens.length) h += `<div class="sq-list">${s.tokens.slice(0, 12).map((t) => `<span class="sq-chip">#${t.id} · Lv${t.level}</span>`).join('')}${s.tokens.length > 12 ? `<span class="mut">+${s.tokens.length - 12}</span>` : ''}</div>`;
      h += W.boost ? `<div class="ok">Starting bonus: ${esc(W.boost.desc)}</div>` : '<div class="mut">No Squeeks at this address → no bonus (the game is still fully playable).</div>';
      if (!s.complete) h += '<div class="mut">Note: the scan did not complete.</div>';
    }
    if (W.status && !W.busy) h += `<div class="${W.error ? 'bad' : 'mut'}">${esc(W.status)}</div>`;
    h += `<div class="btnrow" style="justify-content:flex-start;margin-top:6px"><button id="btn-reread" class="mini">refresh</button><button id="btn-disc" class="mini">disconnect</button></div>`;
  }
  el.innerHTML = h;
  $('btn-connect') && ($('btn-connect').onclick = () => emit('wallet:connect'));
  $('btn-addr') && ($('btn-addr').onclick = () => emit('wallet:addr', $('addr-in').value.trim()));
  $('btn-signin') && ($('btn-signin').onclick = () => emit('auth:signin'));
  $('btn-switch') && ($('btn-switch').onclick = () => emit('wallet:switch'));
  $('btn-reread') && ($('btn-reread').onclick = () => emit('wallet:reread'));
  $('btn-disc') && ($('btn-disc').onclick = () => emit('wallet:disconnect'));
}

export function renderProgress() {
  const s = load(), eq = s.equipped;
  const slot = (id) => { const it = eq[id], sl = SLOTS[id]; return it ? `<div class="slot" style="box-shadow: inset 0 0 0 2px ${rarityOf(it.rarity).color}"><img class="px" src="${spriteURL(sl.icon)}"><div class="nm" style="color:${rarityOf(it.rarity).color}">${esc(it.name)}</div><div class="nm mut">+${Math.round(itemStat(it) * 100)}% ${sl.label}</div></div>` : `<div class="slot"><img class="px" src="${spriteURL(sl.icon)}" style="opacity:.25"><div class="nm mut">${sl.name}: empty</div></div>`; };
  $('prog-body').innerHTML = `
    <div class="row"><span>Seeds 🌻</span><b>${fmt(s.seeds)}</b></div>
    <div class="row"><span>Runs / wins</span><b>${s.runs} / ${s.wins}</b></div>
    <div class="row"><span>Best time</span><b>${Math.floor(s.bestTime / 60)}:${String(Math.floor(s.bestTime % 60)).padStart(2, '0')}</b></div>
    <div class="row"><span>Most kills / level</span><b>${s.bestKills} / ${s.bestLevel}</b></div>
    <div class="row"><span>Chests opened</span><b>${RARITIES.map((r) => `<span style="color:${r.color}">${s.chests[r.id] || 0}</span>`).join(' · ')}</b></div>
    <div class="slots">${slot('weapon')}${slot('helm')}${slot('charm')}</div>`;
}
export function renderShop() {
  const s = load();
  const hint = s.seeds < permCost(0) ? `<div class="mut" style="margin-bottom:4px">Seeds are earned from runs; no wallet needed. Buttons are only disabled when you can't afford them.</div>` : '';
  $('shop-body').innerHTML = hint + PERMS.map((p) => {
    const lvl = s.perm[p.id], cost = permCost(lvl), maxed = lvl >= p.max;
    return `<div class="shop-row"><div><b>${p.name}</b> <span class="mut">Lv ${lvl}/${p.max}</span><div class="mut">${p.desc}</div></div><button data-perm="${p.id}" ${maxed || s.seeds < cost ? 'disabled' : ''}>${maxed ? 'MAX' : cost + ' 🌻'}</button></div>`;
  }).join('');
  document.querySelectorAll('[data-perm]').forEach((b) => { b.onclick = () => { const st = load(), id = b.dataset.perm, p = PERMS.find((x) => x.id === id); const c = permCost(st.perm[id]); if (st.seeds >= c && st.perm[id] < p.max) { st.seeds -= c; st.perm[id]++; save(); sfx.unlock(); sfx.click(); renderProgress(); renderShop(); } }; });
}
export function updateChip() {
  const w = S.wheel; const el = $('chip');
  if (!w) { el.textContent = ''; return; }
  el.textContent = w.ok ? `⛓ Block #${fmt(w.height)} · Wheel: ${w.bonus.label}${S.wallet.boost ? ` · Squeek Lv${S.wallet.boost.best}×${S.wallet.boost.count}` : ''}` : '⛓ chain offline';
}

// ------------------------------------------------------------ Game flow
export function buildMods() {
  const s = load(), eq = equipBonus(), sq = S.wallet.boost, wb = S.wheel?.ok ? S.wheel.bonus : { luck: 0, xp: 0, speed: 0, tier: 'offline' };
  const mods = {
    hp: s.perm.hp * 0.08 + eq.hp + (sq?.hp || 0),
    dmg: s.perm.dmg * 0.06 + eq.dmg + (sq?.dmg || 0),
    spd: s.perm.spd * 0.03, speedBonus: wb.speed || 0,
    xp: s.perm.xp * 0.06 + eq.xp + (sq?.xp || 0) + (wb.xp || 0),
    rerolls: sq?.rerolls || 0, blades: sq?.blades || 0, magnet: s.perm.magnet * 0.15,
  };
  const best = sq?.best || 0;
  const glow = best >= 8 ? 0xffd23f : best >= 5 ? 0xb45cff : best >= 2 ? 0x4aa3ff : best >= 1 ? 0x7dff7d : 0;
  return { mods, glow, chainLuck: (wb.luck || 0) + s.perm.luck * 0.05, chainOnly: wb.luck || 0, tier: wb.tier, height: S.wheel?.ok ? S.wheel.height : null, squeekBest: best };
}
let curCfg = null;
export function startRun() {
  if (S.running) return;
  curCfg = buildMods();
  curCfg.speed = Number(q.get('speed')) || 1; curCfg.bot = q.has('bot'); curCfg.god = q.has('god'); curCfg.touchOnly = q.has('touch');
  ['menu', 'result', 'levelup', 'pause'].forEach((i) => $(i).classList.add('hidden'));
  $('hud').classList.remove('hidden'); syncHudScale();
  S.running = true; bossMusic = false; music.play('battle', { fade: 1.2 });
  S.game.scene.stop('Menu'); S.game.scene.stop('Game'); S.game.scene.start('Game', curCfg);
  updateChip();
  if (curCfg.bot) { const off = on('levelup', (d) => setTimeout(() => emit('pick', d.choices[Math.floor(Math.random() * d.choices.length)].id), 5)); window.__botOff = off; }
}
export function toMenu() {
  S.running = false; bossMusic = false; music.duck(false); music.play('menu', { fade: 1.4 });
  ['hud', 'result', 'levelup', 'pause'].forEach((i) => $(i).classList.add('hidden'));
  $('menu').classList.remove('hidden');
  S.game.scene.stop('Game'); S.game.scene.start('Menu');
  renderAll();
}
function setPause(p, silent) {
  if (!S.running) return;
  const sc = S.game.scene;
  if (p) { if (sc.isActive('Game')) { sc.pause('Game'); $('pause').classList.remove('hidden'); music.duck(true); } }
  else { $('pause').classList.add('hidden'); music.duck(false); if (!silent) sc.resume('Game'); }
}
// Fit the HUD overlay to the rendered canvas and derive a scale unit (1.0 == 960px wide canvas)
export function syncHudScale() {
  const cv = document.querySelector('#game canvas'); const hud = $('hud'); if (!cv || !hud) return;
  const r = cv.getBoundingClientRect(); if (!r.width) return;
  hud.style.left = r.left + 'px'; hud.style.top = r.top + 'px'; hud.style.width = r.width + 'px'; hud.style.height = r.height + 'px';
  hud.style.setProperty('--u', Math.max(0.8, r.width / 960).toFixed(3));
}
window.addEventListener('resize', () => requestAnimationFrame(syncHudScale));
window.addEventListener('orientationchange', () => setTimeout(syncHudScale, 100));
if (window.ResizeObserver) new ResizeObserver(() => syncHudScale()).observe(document.getElementById('game'));

let lastSync = 0;
export function hudSyncTick() { const now = performance.now(); if (now - lastSync > 400) { lastSync = now; syncHudScale(); } }
on('hud', hudSyncTick);

// ------------------------------------------------------------ Result + chest
function showResult(sum) {
  S.running = false; S.lastSummary = sum;
  const s = load();
  sum.seeds = Math.round(sum.seeds * (1 + s.perm.seeds * 0.1));
  s.runs++; if (sum.win) s.wins++; s.seeds += sum.seeds; s.totalKills += sum.kills;
  s.bestTime = Math.max(s.bestTime, sum.time); s.bestKills = Math.max(s.bestKills, sum.kills); s.bestLevel = Math.max(s.bestLevel, sum.level);
  save();
  const cfg = curCfg || buildMods();
  const timeFrac = Math.min(1, sum.time / RUN_SECONDS);
  S.chestRoll = rollChest({ win: sum.win, timeFrac, kills: sum.kills, chainLuck: cfg.chainLuck, squeekBest: cfg.squeekBest, block: cfg.height });
  const mm = Math.floor(sum.time / 60), ss = String(Math.floor(sum.time % 60)).padStart(2, '0');
  $('res-title').innerHTML = sum.win ? '<span class="ok">THE WHEEL STOPPED — YOU SURVIVED!</span>' : '<span class="bad">YOU WERE DEFEATED…</span>';
  $('res-stats').innerHTML = `<div class="scorebig">SCORE <b>${fmt(sum.score || 0)}</b></div><div class="statgrid"><span>Time <b>${mm}:${ss}</b></span><span>Kills <b>${sum.kills}</b></span><span>Level <b>${sum.level}</b></span><span>Bosses <b>${sum.bosses || 0}</b></span><span>Elites <b>${sum.elites || 0}</b></span><span>Best combo <b>x${sum.maxCombo || 0}</b></span></div>${(sum.weapons || []).length ? `<div class="wrow">${sum.weapons.map((w) => `<img class="px" title="${esc(w.name || w.id)} Lv${w.lvl}" src="${spriteURL(w.icon)}">`).join('')}</div>` : ''}<span class="scoreSub" id="res-sync"></span><br>Seeds earned: <b>+${sum.seeds} 🌻</b><br><span class="mut">Chest luck multiplier ×${S.chestRoll.luck.toFixed(2)}` + (cfg.chainOnly ? ` (wheel +${Math.round(cfg.chainOnly * 100)}%)` : '') + (cfg.squeekBest ? ` (Squeek Lv${cfg.squeekBest})` : '') + '</span>';
  const cv = $('chest-cv'); cv.getContext('2d').clearRect(0, 0, 48, 48); cv.getContext('2d').drawImage(spriteCanvas('chest0'), 0, 0);
  $('chest-card').innerHTML = '';
  $('btn-open').classList.remove('hidden'); $('btn-open').disabled = false;
  $('btn-again').classList.add('hidden'); $('btn-tomenu').classList.add('hidden');
  $('hud').classList.add('hidden'); $('result').classList.remove('hidden');
  const sy = $('res-sync'); const W = S.wallet;
  if (sy && W.address && !W.readOnly && W.auth === 'ok') {
    sy.textContent = 'submitting score…';
    api.submitRun(sum).then((r) => { sy.innerHTML = r?.accepted ? `<span class="ok">✔ Score recorded on the leaderboard${r.rank ? ' · rank #' + r.rank : ''}</span>` : `<span class="bad">Run not counted${r?.flag ? ' (' + esc(r.flag) + ')' : ''}</span>`; })
      .catch((e) => { sy.innerHTML = `<span class="bad">Score not submitted: ${esc(e.message === 'OFFLINE' ? 'backend offline (npm start)' : e.message)}</span>`; if (e.status === 401) { api.signOut(W.address); S.wallet.auth = 'none'; renderWallet(); } });
  } else if (sy) sy.textContent = W.address && !W.readOnly ? 'Sign in with your wallet in the menu to post scores.' : 'Connect a wallet to post your score to the leaderboard.';
}
function openChest() {
  const roll = S.chestRoll; if (!roll) return;
  sfx.unlock(); $('btn-open').disabled = true;
  const cv = $('chest-cv'); cv.classList.add('shake'); sfx.beep(200, 0.9, 'sawtooth', 0.03, 300);
  setTimeout(() => {
    cv.classList.remove('shake'); const c = cv.getContext('2d'); c.clearRect(0, 0, 48, 48); c.drawImage(spriteCanvas('chest1'), 0, 0);
    sfx.chest();
    const r = roll.rarity, it = roll.item, sl = SLOTS[it.slot];
    const res = claimItem(it);
    const odds = RARITIES.map((x, i) => `<span style="color:${x.color}">${x.name} ${(roll.weights[i] * 100).toFixed(1)}%</span>`).join(' · ');
    $('chest-card').innerHTML = `<div class="item-card" style="--c:${r.color}"><img class="px" src="${spriteURL(sl.icon)}"><div class="mut">${sl.name}</div><h3>${esc(r.name)} · ${esc(it.name)}</h3><div>+${Math.round(itemStat(it) * 100)}% ${sl.label}${it.slot === 'charm' ? ` · chest luck +${Math.round(0.04 * r.mult * 100)}%` : ''}</div>${it.block ? `<div class="mut">Sealed at block #${esc(it.block)}</div>` : ''}<div style="margin-top:6px">${res.equipped ? '<span class="ok">Equipped!</span>' : `<span class="mut">Weaker than your current item → salvaged</span>`}${res.salvage ? ` <span class="ok">+${res.salvage} 🌻</span>` : ''}</div></div><div class="odds">Odds for this chest: ${odds}</div>`;
    $('btn-again').classList.remove('hidden'); $('btn-tomenu').classList.remove('hidden');
    S.chestRoll = null; window.__lastLoot = { rarity: r.id, item: it, res };
  }, 1000);
}

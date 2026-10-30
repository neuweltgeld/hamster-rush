// Level-up cards: weapons (new / level / evolution), passives and one-shot perks, each rolled with a rarity.
import { WEAPONS, WEAPON_ORDER, PASSIVES, PERKS, RARITY, RARITY_W, MAX_WEAPONS, MAX_PASSIVES } from './defs.js';

export const WEAPON_BONUS = [0, 0.06, 0.12, 0.22, 0.35]; // permanent per-weapon damage bonus by rarity
export const WMAX = 8;

export function newState() {
  return { weapons: [], pass: {}, perk: {}, recent: [] };
}
export const hasWeapon = (g, id) => g.weapons.find((w) => w.id === id);

/** recompute every derived stat from the base mods + passives + perks */
export function recalc(g) {
  const m = g.baseMods, ps = g.pass, pk = g.perk, v = (id) => ps[id]?.v || 0, k = (id) => pk[id]?.m || 0;
  const P = g.P || (g.P = {});
  const oldMax = P.maxHp || 0;
  P.maxHp = (100 * (1 + (m.hp || 0)) + v('vigor')) * (pk.glass ? 0.85 : 1);
  P.speed = 72 * (1 + (m.spd || 0) + (m.speedBonus || 0) + v('swift'));
  P.dmg = (1 + (m.dmg || 0) + v('might') + (pk.glass ? 0.25 * pk.glass.m : 0));
  P.rate = 1 + v('haste') + k('overclock') * 0.08;
  P.area = (1 + v('area')) * (1 + k('bigshot') * 0.07);
  P.size = 1 + k('bigshot') * 0.14;
  P.pspeed = 1 + v('quick'); P.dur = 1 + v('quick') * 0.8;
  P.magnet = 34 * (1 + (m.magnet || 0) + v('magnet'));
  P.xp = 1 + (m.xp || 0) + v('curious');
  P.crit = 0.05 + v('lucky'); P.luck = (g.cfg.chainLuck || 0) + v('lucky') * 0.8 + k('clover') * 0.12;
  P.regen = v('regen'); P.armor = Math.min(0.7, v('armor')); P.fangs = v('fangs'); P.thorns = v('thorns');
  P.amount = ps.amount ? ps.amount.lvl : 0;
  P.pierce = pk.bigshot ? Math.round(pk.bigshot.n) : 0;
  P.seeds = 1 + v('greed') + k('bank') * 0.25; P.gem = 1 + v('greed') * 0.5;
  P.dashCd = 2.4 * Math.max(0.3, 1 - k('dash') * 0.22); P.dashLen = 0.17 * (1 + (pk.dash ? 0.25 * pk.dash.n : 0));
  P.cozy = pk.cozy ? 2 * pk.cozy.m : 0; P.rage = pk.rage ? 0.4 * pk.rage.m : 0; P.cards = pk.wide ? 4 : 3;
  if (g.hp != null && P.maxHp > oldMax && oldMax) g.hp += P.maxHp - oldMax;
  if (g.hp != null) g.hp = Math.min(g.hp, P.maxHp);
  return P;
}

const sumW = (a) => a.reduce((s, x) => s + x, 0);
export function rollRarity(g, rnd) {
  const L = Math.max(0, g.P.luck), lvl = g.level;
  const w = RARITY_W.map((b, i) => b * (1 + (i ? L * i * 1.4 + lvl * 0.012 * i : 0)));
  let r = rnd() * sumW(w);
  for (let i = 0; i < 5; i++) { if (r < w[i]) return i; r -= w[i]; }
  return 0;
}

function describe(g, c) {
  const R = RARITY[c.r];
  if (c.kind === 'weapon') {
    const W = WEAPONS[c.id], cur = hasWeapon(g, c.id);
    if (!cur) return { name: W.name, desc: `${W.blurb}${c.r ? ` Starts with +${Math.round(WEAPON_BONUS[c.r] * 100)}% damage.` : ''}`, tag: 'NEW WEAPON', stack: 1, max: WMAX };
    return { name: W.name, desc: `${W.lv[cur.lvl - 1]}${c.r ? ` · +${Math.round(WEAPON_BONUS[c.r] * 100)}% damage forever` : ''}`, tag: `LV ${cur.lvl} → ${cur.lvl + 1}`, stack: cur.lvl + 1, max: WMAX };
  }
  if (c.kind === 'evo') { const W = WEAPONS[c.id]; return { name: W.evo.name, desc: W.evo.desc, tag: 'EVOLUTION', stack: WMAX, max: WMAX }; }
  if (c.kind === 'passive') {
    const P = PASSIVES[c.id], cur = g.pass[c.id], per = P.per * R.mult;
    return { name: P.name, desc: P.d(per) + (c.pair ? ` · evolves ${WEAPONS[c.pair].name}` : ''), tag: cur ? `LV ${cur.lvl} → ${cur.lvl + 1}` : 'NEW PASSIVE', stack: (cur?.lvl || 0) + 1, max: P.max };
  }
  const K = PERKS[c.id];
  return { name: K.name, desc: K.d(R.mult), tag: 'PERK', stack: (g.perk[c.id]?.n || 0) + 1, max: K.max };
}

export function buildOffer(g, n, rnd = Math.random) {
  const cands = [];
  const nW = g.weapons.length, nP = Object.keys(g.pass).length;
  // evolutions first: guaranteed when available
  for (const w of g.weapons) if (!w.evo && w.lvl >= WMAX && g.pass[WEAPONS[w.id].pair]) cands.push({ key: 'e:' + w.id, kind: 'evo', id: w.id, wt: 1000, r: 4 });
  for (const id of WEAPON_ORDER) {
    const cur = hasWeapon(g, id);
    if (cur) { if (cur.lvl < WMAX && !cur.evo) cands.push({ key: 'w:' + id, kind: 'weapon', id, wt: cur.lvl <= 2 ? 2.2 : 1.6 }); }
    else if (nW < MAX_WEAPONS) cands.push({ key: 'w:' + id, kind: 'weapon', id, wt: nW < 3 ? 2.6 : 1.1 });
  }
  const pairs = new Set(g.weapons.map((w) => WEAPONS[w.id].pair));
  for (const id of Object.keys(PASSIVES)) {
    const cur = g.pass[id], P = PASSIVES[id];
    if (cur ? cur.lvl >= P.max : nP >= MAX_PASSIVES) continue;
    cands.push({ key: 'p:' + id, kind: 'passive', id, wt: (cur ? 1.1 : 1) * (pairs.has(id) ? 1.9 : 1), pair: pairs.has(id) ? Object.keys(WEAPONS).find((k) => WEAPONS[k].pair === id && hasWeapon(g, k)) : null });
  }
  for (const id of Object.keys(PERKS)) {
    const cur = g.perk[id]; if (cur && cur.n >= PERKS[id].max) continue;
    let wt = 0.75;
    if (id === 'heal') wt = g.hp / g.P.maxHp < 0.7 ? 1.6 : 0.2;
    if (id === 'wind' && g.level < 4) wt = 0.3;
    cands.push({ key: 'k:' + id, kind: 'perk', id, wt });
  }
  const out = [], used = new Set();
  const want = n;
  while (out.length < want && cands.length) {
    const ws = cands.map((c) => c.wt * (g.recent.includes(c.key) ? 0.35 : 1) * (used.has(c.key) ? 0 : 1));
    const tot = sumW(ws); if (tot <= 0) break;
    let r = rnd() * tot, i = 0; for (; i < cands.length - 1; i++) { if (r < ws[i]) break; r -= ws[i]; }
    const c = cands.splice(i, 1)[0]; used.add(c.key);
    const rr = c.kind === 'evo' ? 4 : rollRarity(g, rnd);
    const card = { ...c, r: rr, rarity: RARITY[rr].id, color: RARITY[rr].color };
    Object.assign(card, describe(g, card));
    card.icon = c.kind === 'weapon' || c.kind === 'evo' ? WEAPONS[c.id].icon : c.kind === 'passive' ? PASSIVES[c.id].icon : PERKS[c.id].icon;
    card.cid = c.key + '|' + rr; card.idc = card.cid;
    out.push(card);
  }
  out.forEach((c) => { g.recent.push(c.key); }); while (g.recent.length > 8) g.recent.shift();
  return out;
}

/** apply a card; returns a toast string */
export function applyCard(g, c) {
  const R = RARITY[c.r];
  if (c.kind === 'weapon') {
    let w = hasWeapon(g, c.id);
    if (!w) { w = { id: c.id, lvl: 1, bonus: 0, evo: false, cd: 0.4, t: 0, n: 0 }; g.weapons.push(w); g.onWeaponAdd?.(w); }
    else w.lvl = Math.min(WMAX, w.lvl + 1);
    w.bonus += WEAPON_BONUS[c.r]; g.onWeaponChange?.(w);
  } else if (c.kind === 'evo') {
    const w = hasWeapon(g, c.id); w.evo = true; g.onWeaponChange?.(w, true);
  } else if (c.kind === 'passive') {
    const P = PASSIVES[c.id], cur = g.pass[c.id] || (g.pass[c.id] = { lvl: 0, v: 0 });
    cur.lvl++; cur.v += P.per * R.mult;
    if (c.id === 'vigor') { g.hp += 30; }
  } else {
    const cur = g.perk[c.id] || (g.perk[c.id] = { n: 0, m: 0 });
    cur.n++; cur.m += R.mult;
    if (c.id === 'heal') g.healPct(Math.min(1, 0.35 * R.mult));
    if (c.id === 'burst') g.xpBurst(0.35 * R.mult);
    if (c.id === 'vacuum') g.vacuum();
    if (c.id === 'reroll') g.rerolls += R.mult >= 3.4 ? 3 : R.mult >= 2.4 ? 2 : 1;
    if (c.id === 'wind') { cur.left = 1; cur.pct = Math.min(1, 0.4 * R.mult); }
  }
  recalc(g);
  return c.name;
}

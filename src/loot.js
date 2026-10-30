// Chest / rarity system
import { load, save } from './save.js';

export const RARITIES = [
  { id: 'common', name: 'Common', color: '#b8bcc4', mult: 1, w: 60 },
  { id: 'uncommon', name: 'Uncommon', color: '#5ad65a', mult: 1.6, w: 26 },
  { id: 'rare', name: 'Rare', color: '#4aa3ff', mult: 2.4, w: 10 },
  { id: 'epic', name: 'Epic', color: '#b45cff', mult: 3.6, w: 3.5 },
  { id: 'legendary', name: 'Legendary', color: '#ffb02e', mult: 5.5, w: 0.9 },
];
export const SLOTS = {
  weapon: { name: 'Weapon', icon: 'icon_weapon', bases: ['Kernel Launcher', 'Tooth Cannon', 'Grain Rifle'], stat: 'dmg', per: 0.05, label: 'damage' },
  helm: { name: 'Helmet', icon: 'icon_helm', bases: ['Cheese Helm', 'Hazelnut Helmet', 'Wheel Cap'], stat: 'hp', per: 0.06, label: 'max HP' },
  charm: { name: 'Charm', icon: 'icon_charm', bases: ['Seed Charm', 'Amber Necklace', 'Whisker Amulet'], stat: 'xp', per: 0.05, label: 'XP' },
};
const ADJ = ['Worn', 'Sturdy', 'Shiny', 'Ancient', 'Enchanted'];

export const rarityOf = (id) => RARITIES.find((r) => r.id === id);
export const itemStat = (it) => (it ? SLOTS[it.slot].per * rarityOf(it.rarity).mult : 0);

/** Total bonus from equipped items */
export function equipBonus() {
  const eq = load().equipped; const b = { dmg: 0, hp: 0, xp: 0, luck: 0 };
  Object.values(eq).forEach((it) => { if (it) b[SLOTS[it.slot].stat] += itemStat(it); });
  if (eq.charm) b.luck += 0.04 * rarityOf(eq.charm.rarity).mult;
  return b;
}

/**
 * Chest roll.  The luck multiplier grows with survival time, kills, wheel bonus, Squeek bonus and victory;
 * higher-rarity weights scale with luck^i.  Victory guarantees at least "Uncommon".
 */
export function rollChest({ win, timeFrac, kills, chainLuck = 0, squeekBest = 0, block = null }, rnd = Math.random) {
  const eq = equipBonus();
  const luck = 1 + 0.6 * timeFrac + Math.min(0.4, kills / 2500) + chainLuck + eq.luck + (win ? 0.3 : 0) + squeekBest * 0.03;
  const weights = RARITIES.map((r, i) => r.w * Math.pow(luck, i * 1.0));
  const minIdx = win ? 1 : 0;
  for (let i = 0; i < minIdx; i++) weights[i] = 0;
  const sum = weights.reduce((a, b) => a + b, 0);
  let t = rnd() * sum, idx = 0;
  for (; idx < weights.length - 1; idx++) { if (t < weights[idx]) break; t -= weights[idx]; }
  const rarity = RARITIES[idx];
  const slotId = ['weapon', 'helm', 'charm'][Math.floor(rnd() * 3)];
  const slot = SLOTS[slotId];
  const item = {
    id: Date.now().toString(36) + Math.floor(rnd() * 1e4).toString(36),
    slot: slotId, rarity: rarity.id,
    name: `${ADJ[idx]} ${slot.bases[Math.floor(rnd() * slot.bases.length)]}`,
    block: block ? String(block) : null,
  };
  return { item, rarity, luck, weights: weights.map((w) => w / sum) };
}

/** Equip the item (if better) or salvage it → seeds. */
export function claimItem(item) {
  const s = load();
  const cur = s.equipped[item.slot];
  const better = !cur || itemStat(item) > itemStat(cur);
  const worse = better ? cur : item;
  let salvage = 0;
  if (better) s.equipped[item.slot] = item;
  if (worse) salvage = Math.round(6 * Math.pow(rarityOf(worse.rarity).mult, 1.6));
  s.seeds += salvage;
  s.chests[item.rarity] = (s.chests[item.rarity] || 0) + 1;
  save();
  return { equipped: better, replaced: better ? cur : null, salvage };
}

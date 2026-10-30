// Persistent progress in localStorage
const KEY = 'hamsterRush.save.v1';
const def = () => ({
  v: 1, seeds: 0, runs: 0, wins: 0, bestTime: 0, bestKills: 0, bestLevel: 0, totalKills: 0,
  perm: { hp: 0, dmg: 0, spd: 0, xp: 0, magnet: 0, luck: 0, seeds: 0 },
  equipped: { weapon: null, helm: null, charm: null },
  chests: { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 },
  sound: true,
});
let data = null;
export function load() {
  if (data) return data;
  try { data = { ...def(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; data.perm = { ...def().perm, ...data.perm }; data.equipped = { ...def().equipped, ...data.equipped }; data.chests = { ...def().chests, ...data.chests }; }
  catch { data = def(); }
  return data;
}
export function save() { try { localStorage.setItem(KEY, JSON.stringify(load())); } catch { /* private mode etc. */ } }
export function reset() { data = def(); save(); return data; }

export const PERMS = [
  { id: 'hp', name: 'Sturdy Cheeks', desc: '+8% max HP', per: 0.08, max: 10 },
  { id: 'dmg', name: 'Sharp Kernels', desc: '+6% damage', per: 0.06, max: 10 },
  { id: 'spd', name: 'Nimble Paws', desc: '+3% speed', per: 0.03, max: 10 },
  { id: 'xp', name: 'Curious Nose', desc: '+6% XP', per: 0.06, max: 10 },
  { id: 'magnet', name: 'Magnet Cheeks', desc: '+15% pickup range', per: 0.15, max: 6 },
  { id: 'luck', name: 'Four-Leaf Clover', desc: '+5% chest luck', per: 0.05, max: 10 },
  { id: 'seeds', name: 'Tight Pockets', desc: '+10% seed gains', per: 0.1, max: 8 },
];
export const permCost = (lvl) => 20 * (lvl + 1) * (lvl + 2) / 2;

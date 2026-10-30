// Upgrades picked on level-up (1 of 3)
export const UPGRADES = [
  { id: 'dmg', name: 'Sharp Kernel', desc: '+25% damage', max: 8, icon: 'up_dmg', apply: (p) => { p.dmg *= 1.25; } },
  { id: 'rate', name: 'Fast Chewing', desc: '+20% fire rate', max: 8, icon: 'up_rate', apply: (p) => { p.rate *= 1.2; } },
  { id: 'multi', name: 'Multi-Spit', desc: '+1 projectile', max: 4, icon: 'up_multi', apply: (p) => { p.proj += 1; } },
  { id: 'pierce', name: 'Piercing Tip', desc: 'Projectiles pierce +1 enemy', max: 4, icon: 'up_pierce', apply: (p) => { p.pierce += 1; } },
  { id: 'speed', name: 'Running Shoes', desc: '+10% speed', max: 5, icon: 'up_speed', apply: (p) => { p.speed *= 1.1; } },
  { id: 'hp', name: 'Chubby Cheeks', desc: '+25 max HP and a heal', max: 6, icon: 'up_hp', apply: (p) => { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 40); } },
  { id: 'magnet', name: 'Magnet Whiskers', desc: '+50% pickup range', max: 5, icon: 'up_magnet', apply: (p) => { p.magnet *= 1.5; } },
  { id: 'xp', name: 'Bright Curiosity', desc: '+20% XP', max: 5, icon: 'up_xp', apply: (p) => { p.xpMul *= 1.2; } },
  { id: 'blade', name: 'Wheel Blade', desc: '+1 orbiting blade', max: 5, icon: 'up_blade', apply: (p) => { p.blades += 1; } },
  { id: 'crit', name: 'Lucky Star', desc: '+12% crit chance (x2 damage)', max: 5, icon: 'up_crit', apply: (p) => { p.crit += 0.12; } },
  { id: 'nova', name: 'Cheese Wave', desc: 'Periodic shockwave (wider and more frequent per level)', max: 5, icon: 'up_nova', apply: (p) => { p.nova += 1; } },
  { id: 'bomb', name: 'Hazelnut Bomb', desc: '+1 bomb: thrown at a random enemy, area damage', max: 4, icon: 'up_bomb', apply: (p) => { p.bombs += 1; } },
  { id: 'vamp', name: 'Sharp Fangs', desc: 'Heal a bit on every kill', max: 4, icon: 'up_vamp', apply: (p) => { p.vamp += 0.35; } },
  { id: 'regen', name: 'Cheese Break', desc: '+1.2 HP per second', max: 5, icon: 'up_regen', apply: (p) => { p.regen += 1.2; } },
];
export function pickChoices(taken, rnd = Math.random, n = 3) {
  const pool = UPGRADES.filter((u) => (taken[u.id] || 0) < u.max);
  const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  return out;
}

// Static game data: enemies, elite affixes, bosses, weapons, passives, perks, rarities.
export const RUN_SECONDS = 330;
export const RARITY = [
  { id: 'common', name: 'Common', color: '#b8bcc4', hex: 0xb8bcc4, mult: 1, wb: 0 },
  { id: 'uncommon', name: 'Uncommon', color: '#5ee07a', hex: 0x5ee07a, mult: 1.35, wb: 0.06 },
  { id: 'rare', name: 'Rare', color: '#4aa8ff', hex: 0x4aa8ff, mult: 1.8, wb: 0.12 },
  { id: 'epic', name: 'Epic', color: '#c15cff', hex: 0xc15cff, mult: 2.5, wb: 0.22 },
  { id: 'legendary', name: 'Legendary', color: '#ffb82e', hex: 0xffb82e, mult: 3.5, wb: 0.35 },
];
export const RARITY_W = [58, 26, 11, 4, 1];

// tex: texture family (frames <tex>_w0..7, anim <tex>_walk) · T: texture px · oy: feet offset · r: hit radius (world px)
// from: unlock time (s) · w: spawn weight · col: death tint · ai: behaviour
export const ENEMIES = {
  beetle: { name: 'Beetle', tex: 'beetle', T: 40, oy: 4, hp: 3, spd: 26, dmg: 7, xp: 1, r: 6.5, col: 0x7dff7d, from: 0, w: 40 },
  ant: { name: 'Ant', tex: 'ant', T: 40, oy: 4, hp: 2, spd: 47, dmg: 5, xp: 1, r: 5, col: 0xff6a5a, from: 0, w: 30 },
  rat: { name: 'Rat', tex: 'rat', T: 48, oy: 3, hp: 4, spd: 54, dmg: 6, xp: 1, r: 5.5, col: 0xc8b8a8, from: 15, w: 24, ai: 'pack' },
  bee: { name: 'Wasp', tex: 'bee', T: 48, oy: 2, hp: 3, spd: 52, dmg: 6, xp: 2, r: 5, col: 0xffe14a, from: 35, w: 16, ai: 'zig', fly: 1 },
  slime: { name: 'Slime', tex: 'slime', T: 48, oy: 3, hp: 10, spd: 22, dmg: 8, xp: 3, r: 7.5, col: 0x6aff9a, from: 50, w: 13, ai: 'hop', split: 1 },
  snake: { name: 'Snake', tex: 'snake', T: 48, oy: 2, hp: 8, spd: 33, dmg: 9, xp: 3, r: 7, col: 0xffe066, from: 60, w: 14 },
  bat: { name: 'Bat', tex: 'bat', T: 48, oy: 2, hp: 2, spd: 56, dmg: 6, xp: 2, r: 6, col: 0xcfc8ff, from: 75, w: 14, ai: 'bat', fly: 1 },
  hedgehog: { name: 'Hedgehog', tex: 'hedgehog', T: 48, oy: 3, hp: 14, spd: 24, dmg: 9, xp: 4, r: 7.5, col: 0xd8c0a0, from: 90, w: 9, ai: 'hedge' },
  mole: { name: 'Mole', tex: 'mole', T: 48, oy: 3, hp: 16, spd: 30, dmg: 12, xp: 5, r: 7.5, col: 0xb89a80, from: 105, w: 8, ai: 'mole' },
  spitter: { name: 'Spitter', tex: 'spitter', T: 48, oy: 5, hp: 8, spd: 25, dmg: 8, xp: 4, r: 8, col: 0x9aff7a, from: 120, w: 9, ai: 'spit' },
  skunk: { name: 'Skunk', tex: 'skunk', T: 48, oy: 3, hp: 15, spd: 27, dmg: 9, xp: 5, r: 8, col: 0xe0e0f0, from: 135, w: 7, ai: 'skunk' },
  crow: { name: 'Crow', tex: 'crow', T: 48, oy: 2, hp: 9, spd: 50, dmg: 11, xp: 4, r: 6.5, col: 0x9a9ab8, from: 150, w: 8, ai: 'crow', fly: 1 },
  cat: { name: 'Alley Cat', tex: 'cat', T: 48, oy: 4, hp: 22, spd: 29, dmg: 14, xp: 8, r: 8.5, col: 0xffffff, from: 165, w: 9, ai: 'cat' },
  boar: { name: 'Boar', tex: 'boar', T: 64, oy: 3, hp: 42, spd: 20, dmg: 18, xp: 12, r: 12.5, col: 0xffd070, from: 180, w: 4, ai: 'boar' },
  bombbug: { name: 'Bomb Bug', tex: 'bombbug', T: 48, oy: 3, hp: 8, spd: 44, dmg: 14, xp: 5, r: 6.5, col: 0xff8a3a, from: 200, w: 7, ai: 'bomb' },
  // spawned by other enemies only
  miniSlime: { name: 'Mini Slime', tex: 'slime', T: 48, oy: 3, hp: 3, spd: 34, dmg: 5, xp: 1, r: 4.5, col: 0x6aff9a, from: 1e9, w: 0, ai: 'hop', sc: 0.62 },
  hedgeball: { name: 'Hedgeball', tex: 'hedgeball', T: 40, oy: 2, hp: 14, spd: 24, dmg: 9, xp: 4, r: 7, col: 0xd8c0a0, from: 1e9, w: 0 },
  // bosses
  hornet: { name: 'Hornet Queen', tex: 'hornet', T: 128, oy: 6, hp: 520, spd: 30, dmg: 20, xp: 80, r: 20, col: 0xffe14a, fly: 1, boss: 1, ai: 'hornet', sc: 1 },
  king: { name: 'Cat King', tex: 'boss', T: 128, oy: 8, hp: 1050, spd: 23, dmg: 24, xp: 120, r: 22, col: 0xff6a5a, boss: 1, ai: 'king', sc: 1 },
  titan: { name: 'Mole Titan', tex: 'titan', T: 128, oy: 6, hp: 1750, spd: 21, dmg: 28, xp: 200, r: 24, col: 0xb89a80, boss: 1, ai: 'titan', sc: 1 },
};
export const BOSS_SCHEDULE = [[95, 'hornet'], [195, 'king'], [275, 'titan']];
export const AFFIX = {
  armored: { name: 'Armored', tint: 0x9ab8ff, armor: 0.45, hp: 1.3 },
  swift: { name: 'Swift', tint: 0xffe14a, spd: 1.5 },
  volatile: { name: 'Volatile', tint: 0xff7a3a, boom: 1 },
  leader: { name: 'Pack Leader', tint: 0xff5aa0, summon: 1 },
};

// ---- weapons (logic in weapons.js). max level 8. Evolution needs the paired passive (any level) + weapon at max.
export const WEAPONS = {
  seed: { name: 'Seed Spitter', icon: 'ic_seed', blurb: 'Spits seeds at the nearest enemy.', pair: 'might', evo: { name: 'Sunflower Storm', desc: 'Homing seeds, piercing, and a seed nova every 4th volley.' },
    lv: ['+25% damage', '+1 seed', '+20% fire rate', '+1 pierce', '+25% damage', '+1 seed', '+1 pierce, +20% fire rate'] },
  blades: { name: 'Wheel Saw', icon: 'ic_blades', blurb: 'Saw blades orbit your hamster.', pair: 'swift', evo: { name: 'Flaming Hamster Wheel', desc: 'Blazing saws, a second orbit ring, burning and a fire trail.' },
    lv: ['+1 blade', '+25% damage', '+wider orbit', '+1 blade', '+25% damage, faster spin', '+1 blade', '+1 blade'] },
  wave: { name: 'Cheese Wave', icon: 'ic_wave', blurb: 'Periodic shockwave that shoves and hurts.', pair: 'area', evo: { name: 'Fondue Tsunami', desc: 'Twin waves, and sticky cheese pools that slow and burn.' },
    lv: ['+wider wave', '+25% damage', '-12% cooldown', '+wider wave', '+25% damage', '-12% cooldown', '+wider wave, +knockback'] },
  bomb: { name: 'Hazelnut Bomb', icon: 'ic_bomb', blurb: 'Lobs bombs onto groups of enemies.', pair: 'amount', evo: { name: 'Nutcracker Barrage', desc: 'Bombs burst into a ring of cluster bombs.' },
    lv: ['+1 bomb', '+bigger blast', '-10% cooldown', '+1 bomb', '+25% damage', '+bigger blast', '+1 bomb'] },
  boomerang: { name: 'Acorn Boomerang', icon: 'ic_boomerang', blurb: 'A piercing acorn that returns to you.', pair: 'quick', evo: { name: 'Golden Acorn', desc: 'Giant golden acorn that explodes at both ends.' },
    lv: ['+25% damage', '+1 acorn', '-10% cooldown', '+longer flight', '+25% damage', '+1 acorn', '+bigger acorns'] },
  lightning: { name: 'Whisker Zap', icon: 'ic_lightning', blurb: 'Lightning leaps between enemies.', pair: 'lucky', evo: { name: 'Storm Whiskers', desc: 'Huge chain lightning that stuns and strikes constantly.' },
    lv: ['+1 chain', '+25% damage', '+1 strike', '-10% cooldown', '+1 chain', '+25% damage', '+1 strike'] },
  flame: { name: 'Chili Breath', icon: 'ic_flame', blurb: 'A cone of fire that burns enemies.', pair: 'haste', evo: { name: 'Dragon Chili', desc: 'Wider, longer inferno that leaves burning ground.' },
    lv: ['+longer range', '+25% damage', '+wider cone', '+25% burn', '+longer range', '+25% damage', '+wider cone'] },
  frost: { name: 'Snow Burst', icon: 'ic_frost', blurb: 'Snowballs that slow and freeze.', pair: 'armor', evo: { name: 'Blizzard', desc: 'A freezing aura and homing snow volleys.' },
    lv: ['+2 snowballs', '+25% damage', '-10% cooldown', '+freeze chance', '+2 snowballs', '+25% damage', '+freeze chance'] },
  mines: { name: 'Thorn Traps', icon: 'ic_mines', blurb: 'Drops traps that explode when stepped on.', pair: 'greed', evo: { name: 'Cluster Mines', desc: 'Mines also launch a ring of thorns.' },
    lv: ['+1 trap', '+bigger blast', '-10% cooldown', '+25% damage', '+1 trap', '+bigger blast', '+1 trap'] },
  bees: { name: 'Bee Buddies', icon: 'ic_bees', blurb: 'Friendly bees dive at enemies.', pair: 'curious', evo: { name: 'Hive Queen', desc: 'More bees, stronger stings and honey pools.' },
    lv: ['+1 bee', '+25% damage', '+1 bee', '+faster dives', '+25% damage', '+1 bee', '+1 bee'] },
  meteor: { name: 'Star Fall', icon: 'ic_meteor', blurb: 'Calls meteors down on enemies.', pair: 'magnet', evo: { name: 'Meteor Shower', desc: 'A rain of meteors that leaves burning ground.' },
    lv: ['+bigger crater', '+25% damage', '-10% cooldown', '+1 meteor', '+25% damage', '+bigger crater', '+1 meteor'] },
  beam: { name: 'Gem Laser', icon: 'ic_beam', blurb: 'A piercing laser sweeps through enemies.', pair: 'vigor', evo: { name: 'Prism Cannon', desc: 'Three prismatic beams, longer and hotter.' },
    lv: ['+25% damage', '+longer beam', '-10% cooldown', '+wider beam', '+25% damage', '+longer beam', '-10% cooldown'] },
};
export const WEAPON_ORDER = Object.keys(WEAPONS);

export const PASSIVES = {
  might: { name: 'Sharp Kernel', icon: 'ic_might', max: 5, per: 0.12, d: (v) => `+${Math.round(v * 100)}% damage` },
  haste: { name: 'Fast Chewing', icon: 'ic_haste', max: 5, per: 0.09, d: (v) => `+${Math.round(v * 100)}% fire rate` },
  swift: { name: 'Running Shoes', icon: 'ic_swift', max: 5, per: 0.08, d: (v) => `+${Math.round(v * 100)}% move speed` },
  vigor: { name: 'Chubby Cheeks', icon: 'ic_vigor', max: 5, per: 20, d: (v) => `+${Math.round(v)} max HP and a heal` },
  magnet: { name: 'Magnet Whiskers', icon: 'ic_magnet', max: 5, per: 0.25, d: (v) => `+${Math.round(v * 100)}% pickup range` },
  curious: { name: 'Bright Curiosity', icon: 'ic_curious', max: 5, per: 0.1, d: (v) => `+${Math.round(v * 100)}% XP` },
  lucky: { name: 'Lucky Star', icon: 'ic_lucky', max: 5, per: 0.06, d: (v) => `+${Math.round(v * 100)}% crit chance and better card rarity` },
  fangs: { name: 'Sharp Fangs', icon: 'ic_fangs', max: 5, per: 0.3, d: (v) => `Heal ${v.toFixed(1)} HP per kill` },
  regen: { name: 'Cheese Break', icon: 'ic_regen', max: 5, per: 0.7, d: (v) => `+${v.toFixed(1)} HP per second` },
  area: { name: 'Big Burrow', icon: 'ic_area', max: 5, per: 0.1, d: (v) => `+${Math.round(v * 100)}% area size` },
  quick: { name: 'Quick Paws', icon: 'ic_quick', max: 5, per: 0.1, d: (v) => `+${Math.round(v * 100)}% projectile speed and duration` },
  armor: { name: 'Fur Coat', icon: 'ic_armor', max: 5, per: 0.07, d: (v) => `-${Math.round(v * 100)}% damage taken` },
  amount: { name: 'Twin Cheeks', icon: 'ic_amount', max: 2, per: 1, d: (v) => `+${Math.round(v)} projectile for every weapon` },
  greed: { name: 'Seed Hoarder', icon: 'ic_greed', max: 5, per: 0.12, d: (v) => `+${Math.round(v * 100)}% seeds, +${Math.round(v * 50)}% gem XP` },
  thorns: { name: 'Prickly Fur', icon: 'ic_thorns', max: 5, per: 6, d: (v) => `Reflect ${Math.round(v)} damage to attackers` },
};
export const PERKS = {
  glass: { name: 'Glass Cannon', icon: 'ic_glass', max: 1, d: (m) => `+${Math.round(25 * m)}% damage, -15% max HP` },
  wind: { name: 'Second Wind', icon: 'ic_wind', max: 1, d: (m) => `Revive once with ${Math.min(100, Math.round(40 * m))}% HP` },
  heal: { name: 'Cheese Feast', icon: 'ic_heal', max: 99, d: (m) => `Heal ${Math.min(100, Math.round(35 * m))}% of your max HP` },
  burst: { name: 'Gem Burst', icon: 'ic_burst', max: 99, d: (m) => `Gain ${Math.round(35 * m)}% of a level in XP` },
  bank: { name: 'Cheese Bank', icon: 'ic_bank', max: 3, d: (m) => `+${Math.round(25 * m)}% seeds earned this run` },
  cozy: { name: 'Cozy Burrow', icon: 'ic_cozy', max: 1, d: (m) => `Standing still heals ${(2 * m).toFixed(1)} HP/s` },
  rage: { name: 'Berserk Fur', icon: 'ic_rage', max: 1, d: (m) => `Up to +${Math.round(40 * m)}% damage as your HP drops` },
  clover: { name: 'Lucky Clover', icon: 'ic_clover', max: 3, d: (m) => `+${Math.round(12 * m)}% luck: rarer cards` },
  vacuum: { name: 'Gem Vacuum', icon: 'ic_vacuum', max: 99, d: () => 'Instantly pull in every gem on the map' },
  reroll: { name: 'Spare Paws', icon: 'ic_reroll', max: 99, d: (m) => `+${m >= 3.4 ? 3 : m >= 2.4 ? 2 : 1} reroll${m >= 2.4 ? 's' : ''}` },
  overclock: { name: 'Overclock', icon: 'ic_overclock', max: 3, d: (m) => `+${Math.round(8 * m)}% attack speed` },
  bigshot: { name: 'Bigger Bullets', icon: 'ic_bigshot', max: 3, d: (m) => `+${Math.round(14 * m)}% projectile size and +1 pierce` },
  dash: { name: 'Quick Dash', icon: 'ic_dash', max: 2, d: (m) => `-${Math.round(22 * m)}% dash cooldown, longer dash` },
  wide: { name: 'Wide Choice', icon: 'ic_wide', max: 1, d: () => 'One more card on every level-up' },
};
export const MAX_WEAPONS = 6, MAX_PASSIVES = 8;

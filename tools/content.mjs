// Content audit (needs the DEV server: node tools/content.mjs http://127.0.0.1:5201/)
import puppeteer from 'puppeteer-core';
const base = process.argv[2] || 'http://127.0.0.1:5201/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--enable-unsafe-swiftshader'], headless: true });
const p = await b.newPage(); await p.setViewport({ width: 1000, height: 600 });
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(base + '?bot=1&god=1&autoplay=1'); await sleep(3500);
const r = await p.evaluate(async () => {
  const D = await import('/src/defs.js'), C = await import('/src/cards.js'); const g = window.__hr; const tex = g.textures;
  const out = { enemies: [], weapons: Object.keys(D.WEAPONS).length, passives: Object.keys(D.PASSIVES).length, perks: Object.keys(D.PERKS).length, missingTex: [], missingIcons: [] };
  for (const [k, e] of Object.entries(D.ENEMIES)) { out.enemies.push(k + (e.boss ? '(boss)' : '')); if (k === 'hedgeball') { if (!tex.exists('hedgeball')) out.missingTex.push('hedgeball'); continue; } for (let i = 0; i < 8; i++) if (!tex.exists(e.tex + '_w' + i)) out.missingTex.push(e.tex + '_w' + i); }
  for (const [k, w] of Object.entries(D.WEAPONS)) { if (!tex.exists('ic_' + w.icon) && !tex.exists(w.icon)) out.missingIcons.push(w.icon); if (!w.pair || !D.PASSIVES[w.pair]) out.missingIcons.push('nopair:' + k); }
  for (const s of [D.PASSIVES, D.PERKS]) for (const v of Object.values(s)) if (!tex.exists('ic_' + v.icon) && !tex.exists(v.icon)) out.missingIcons.push(v.icon);
  // simulate 40 level-ups with random picks
  window.__botOff = true; const seen = new Set(), rar = [0, 0, 0, 0, 0]; let rep = 0, prev = new Set(), offers = 0, sig = new Set();
  for (let i = 0; i < 40; i++) {
    const o = C.buildOffer(g, 3); offers++;
    for (const c of o) { seen.add(c.kind + ':' + c.id); rar[c.r]++; if (prev.has(c.kind + ':' + c.id)) rep++; }
    sig.add(o.map((c) => c.cid).sort().join(','));
    prev = new Set(o.map((c) => c.kind + ':' + c.id));
    C.applyCard(g, o[Math.floor(Math.random() * o.length)]);
  }
  out.distinctCardsIn40 = seen.size; out.rarityCounts = rar; out.consecutiveRepeats = rep; out.distinctOffers = sig.size; out.weaponsHeld = g.weapons.length;
  return out;
});
console.log(JSON.stringify(r, null, 1));
let fail = 0; const chk = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
chk(r.enemies.filter((e) => !e.includes('boss')).length >= 12, '12+ regular enemy defs (' + r.enemies.length + ' incl. bosses)');
chk(r.enemies.filter((e) => e.includes('boss')).length >= 2, '2+ bosses');
chk(r.weapons >= 10, '10+ weapons (' + r.weapons + ')');
chk(!r.missingTex.length, 'all enemy textures present ' + r.missingTex.join());
chk(!r.missingIcons.length, 'all icons / evolution pairs present ' + r.missingIcons.join());
chk(r.distinctCardsIn40 >= 30, 'level-up variety: ' + r.distinctCardsIn40 + ' distinct cards across 40 offers');
chk(r.distinctOffers >= 36, 'offers rarely identical: ' + r.distinctOffers + '/40');
chk(r.rarityCounts.filter((x) => x > 0).length >= 4, 'rarity tiers seen ' + r.rarityCounts.join('/'));
console.log(errs.join('\n') || 'no errors'); if (errs.length) fail++;
await b.close(); process.exit(fail ? 1 : 0);

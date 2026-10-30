// node tools/stress.mjs <baseUrl> <tag> <evo 0|1> [extraQuery]
import puppeteer from 'puppeteer-core';
const [base = 'http://127.0.0.1:5201/', tag = 'st', evo = '0', xq = ''] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--enable-unsafe-swiftshader'], headless: true });
const p = await b.newPage(); await p.setViewport({ width: 1000, height: 600 });
const errs = new Set(); p.on('pageerror', (e) => errs.add('PAGEERR ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.add(m.text().slice(0, 200)); });
await p.goto(base + '?bot=1&god=1&autoplay=1&nodegrade=1' + xq); await sleep(4500);
await p.evaluate((evo) => { const g = window.__hr; g.gainXp = () => {}; for (const id of ['seed','blades','wave','bomb','boomerang','lightning','flame','frost','mines','bees','meteor','beam']) { const w = g.addWeapon(id, 8); if (evo === '1') { w.evo = true; g.onWeaponChange(w, false); } } }, evo);
const stamps = [[20, 'early'], [94, 'hornet'], [194, 'king'], [274, 'titan'], [300, 'late']];
for (const [t, label] of stamps) {
  await p.evaluate((t) => { window.__hr.t = t; }, t);
  for (let i = 0; i < 3; i++) {
    await sleep(5000);
    const r = await p.evaluate(() => { const g = window.__hr; const bs = g.bosses || []; return { t: g.t | 0, en: g.en.length, pj: g.pj.length, ep: g.ep.length, zones: g.zones.length, ms: +(g.perf?.ms ?? 0).toFixed?.(2), fps: window.__game.loop.actualFps | 0, boss: bs[0] ? bs[0].d.name + ' ' + (bs[0].hp / bs[0].mhp).toFixed(2) : null, kills: g.kills }; });
    console.log(label, JSON.stringify(r));
  }
  await p.screenshot({ path: `/tmp/${tag}-${label}.png` });
}
console.log('ERRORS:', [...errs].join('\n') || 'none');
await b.close();

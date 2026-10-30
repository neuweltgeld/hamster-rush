import puppeteer from 'puppeteer-core';
const base = process.argv[2] || 'http://127.0.0.1:5201/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--enable-unsafe-swiftshader'], headless: true });
const p = await b.newPage(); await p.setViewport({ width: 1000, height: 600 });
const errs = []; p.on('pageerror', (e) => errs.push('PAGEERR ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(base + '?bot=1&god=1&autoplay=1&nodegrade=1'); await sleep(4500);
await p.evaluate(() => { const g = window.__hr; g.gainXp = () => {}; for (const id of ['blades','wave','bomb','lightning','flame','bees','meteor','frost']) g.addWeapon(id, 6); g.t = 70; });
for (let i = 0; i < 4; i++) { await sleep(5000); await p.screenshot({ path: `/tmp/c${i}.png` }); console.log(await p.evaluate(() => { const g = window.__hr; return { t: g.t | 0, en: g.en.length, pj: g.pj.length, fps: window.__game.loop.actualFps | 0 }; })); }
await p.evaluate(() => { const g = window.__hr; g.t = 94; });
for (let i = 0; i < 3; i++) { await sleep(6000); await p.screenshot({ path: `/tmp/b${i}.png` }); console.log(await p.evaluate(() => { const g = window.__hr; return { t: g.t | 0, en: g.en.length, boss: g.bosses.length }; })); }
console.log(errs.slice(0, 10).join('\n') || 'no errors');
await b.close();

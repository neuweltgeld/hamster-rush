// screenshots of the biomes: node tools/tour.mjs <baseUrl> <outPrefix>
import puppeteer from 'puppeteer-core';
const [base = 'http://127.0.0.1:5200/', pre = '/tmp/tour'] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'], headless: true });
const p = await b.newPage(); await p.setViewport({ width: 960, height: 540 });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(base + '?god=1&autoplay=1'); await sleep(2500);
const spots = { ruins: [1024, 640], cheese: [420, 1200], pond: [440, 520], forest: [1500, 330], stones: [700, 840], farm: [1450, 1180] };
for (const [k, [x, y]] of Object.entries(spots)) {
  await p.evaluate((x, y) => { const g = window.__hr; g.player.setPosition(x, y); g.camX = x; g.camY = y; g.enemies.clear(true, true); g.spawnAcc = -999; }, x, y);
  await sleep(1800); await p.screenshot({ path: `${pre}-${k}.png` });
}
console.log(errs.join('\n') || 'no errors'); await b.close();

// Headless end-to-end test: node tools/e2e.mjs [baseUrl]
import puppeteer from 'puppeteer-core';
const base = process.argv[2] || 'http://127.0.0.1:4180/';
const errs = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function page(b, url, { blockRpc = false, w = 1000, h = 700 } = {}) {
  const p = await b.newPage(); await p.setViewport({ width: w, height: h });
  p.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !(blockRpc && /Failed to load resource|ERR_/.test(m.text()))) errs.push('CONSOLE ' + m.text()); });
  if (blockRpc) { await p.setRequestInterception(true); p.on('request', (r) => (r.url().startsWith(base) || r.url().startsWith('data:') ? r.continue() : r.abort())); }
  await p.goto(url); return p;
}
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'], headless: true });

// 1) Normal load + chain
let p = await page(b, base); await sleep(9000);
await p.screenshot({ path: '/tmp/s_menu.png' });
console.log('wheel panel:', (await p.$eval('#wheel-body', (e) => e.innerText)).replace(/\n/g, ' | '));

// 2) Bot + fast game -> result + chest
await p.close();
p = await page(b, base + '?bot=1&speed=8&god=1&autoplay=1'); await sleep(2500);
await p.screenshot({ path: '/tmp/s_play.png' });
await sleep(8000); await p.evaluate(() => { const g = window.__hr; if (g) g.t = 326; });
for (let i = 0; i < 40; i++) { await sleep(1500); if (await p.$eval('#result', (e) => !e.classList.contains('hidden'))) break; }
console.log('result visible:', await p.$eval('#result', (e) => !e.classList.contains('hidden')));
console.log('stats:', (await p.$eval('#res-stats', (e) => e.innerText)).replace(/\n/g, ' | '));
await p.screenshot({ path: '/tmp/s_result.png' });
await p.click('#btn-open'); await sleep(1600);
await p.screenshot({ path: '/tmp/s_chest.png' });
console.log('loot:', JSON.stringify(await p.evaluate(() => window.__lastLoot)));
console.log('save:', await p.evaluate(() => localStorage.getItem('hamsterRush.save.v1')));
await p.click('#btn-tomenu'); await sleep(500);
await p.screenshot({ path: '/tmp/s_menu2.png' });
await p.reload(); await sleep(1500);
console.log('persist after reload:', (await p.$eval('#prog-body', (e) => e.innerText)).replace(/\n/g, ' | ').slice(0, 200));
await p.close();

// 3) RPC down
p = await page(b, base, { blockRpc: true }); await sleep(12000);
console.log('offline panel:', (await p.$eval('#wheel-body', (e) => e.innerText)).replace(/\n/g, ' | '));
await p.screenshot({ path: '/tmp/s_offline.png' });
await p.evaluate(() => document.getElementById('btn-play').click()); await sleep(5000);
console.log('offline game running, timer:', await p.$eval('#timer', (e) => e.innerText), 'enemies>0:', await p.evaluate(() => window.__hr?.enemies?.countActive?.()));
await p.screenshot({ path: '/tmp/s_off_play.png' });
await p.close();

// 4) Adres modu
p = await page(b, base + '?addr=' + (process.env.ADDR || '0x0000000000000000000000000000000000000001')); await sleep(15000);
console.log('wallet panel:', (await p.$eval('#wallet-body', (e) => e.innerText)).replace(/\n/g, ' | '));
await p.screenshot({ path: '/tmp/s_addr.png' });
await b.close();
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'NO CONSOLE/PAGE ERRORS');

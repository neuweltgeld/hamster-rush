import puppeteer from 'puppeteer-core';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const base = 'http://127.0.0.1:4180/';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'], headless: true });
const p = await b.newPage(); await p.setViewport({ width: 1000, height: 700 });
p.on('pageerror', (e) => console.log('PAGEERR', e.message));
await p.goto(base + '?bot=1&speed=' + (process.argv[2] || 4) + (process.argv[3] ? '&god=1' : '') + '&autoplay=1'); await sleep(2000);
let shot = 0;
for (let i = 0; i < 60; i++) {
  await sleep(4000);
  const s = await p.evaluate(() => { const g = window.__hr; return g ? { t: +g.t.toFixed(0), lv: g.level, k: g.kills, hp: Math.round(g.hp), en: g.en.length, ov: !document.getElementById('result').classList.contains('hidden') } : null; });
  console.log(JSON.stringify(s));
  if (s && s.t > 150 && !shot) { await p.screenshot({ path: '/tmp/s_late.png' }); shot = 1; }
  if (!s || s.ov) break;
}
await b.close();

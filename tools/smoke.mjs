// quick smoke: node tools/smoke.mjs <baseUrl> <out.png> [seconds] [query]
import puppeteer from 'puppeteer-core';
const [base = 'http://127.0.0.1:5200/', out = '/tmp/smoke.png', secs = '8', q = '?bot=1&god=1&autoplay=1'] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--enable-unsafe-swiftshader'], headless: true });
const p = await b.newPage(); await p.setViewport({ width: 1000, height: 600 });
const errs = []; p.on('pageerror', (e) => errs.push('PAGEERR ' + e.message)); p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errs.push(m.type() + ' ' + m.text()); });
await p.goto(base + q); await sleep(4000);
await p.screenshot({ path: out.replace('.png', '-a.png') });
await sleep(+secs * 1000);
const info = await p.evaluate(() => { const g = window.__hr; return { fps: window.__game?.loop?.actualFps, t: g?.t, enemies: g?.enemies?.countActive?.(), px: g?.player?.x, py: g?.player?.y, build: g?.world?.buildMs, props: g?.world?.props?.length, kids: g?.children?.length, chunks: g?.world?.painted }; });
console.log(JSON.stringify(info));
await p.screenshot({ path: out });
console.log(errs.slice(0, 10).join('\n') || 'no errors');
await b.close();

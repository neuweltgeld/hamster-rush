// node tools/wall.mjs [baseUrl] [outDir]  → 5 scenes × (1920x1080, 1080x1920) PNGs
import puppeteer from 'puppeteer-core'; import fs from 'node:fs';
const [base = 'http://127.0.0.1:5200/', out = '/workspace/wallpapers'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'], headless: true });
const p = await b.newPage(); p.on('pageerror', (e) => console.log('PAGEERR', e.message)); p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
await p.goto(base + 'tools/wall.html'); await p.waitForFunction('window.ready', { timeout: 60000 });
const names = await p.evaluate('window.SCENES'); const only = process.env.ONLY;
for (const n of names) { if (only && n !== only) continue; for (const [w, h, tag] of [[1920, 1080, 'landscape-1920x1080'], [1080, 1920, 'portrait-1080x1920']]) {
  const url = await p.evaluate((n, w, h) => window.renderScene(n, w, h), n, w, h); const f = `${out}/hamster-rush-${n}-${tag}.png`; fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64')); console.log(f); } }
await b.close();

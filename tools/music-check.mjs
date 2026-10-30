// Renders each song offline in headless Chrome and reports peak/RMS (loudness sanity check)
import puppeteer from 'puppeteer-core';
const base = process.argv[2] || 'http://127.0.0.1:5200/';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage(); p.on('pageerror', (e) => console.log('PAGEERR', e.message)); p.on('console', (m) => { if (m.type() === 'error') console.log('ERR', m.text()); });
await p.goto(base, { waitUntil: 'load' });
for (const [name, secs] of [['menu', 40], ['battle', 32], ['boss', 24]]) {
  const r = await p.evaluate(async (name, secs) => {
    const { renderOffline } = await import('/src/music.js'); const buf = await renderOffline(name, secs);
    const d = buf.getChannelData(0); let pk = 0, ss = 0; for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > pk) pk = a; ss += d[i] * d[i]; }
    return { peak: pk, rms: Math.sqrt(ss / d.length) };
  }, name, secs);
  console.log(name, 'peak', r.peak.toFixed(3), 'rms', r.rms.toFixed(3));
}
await b.close();
